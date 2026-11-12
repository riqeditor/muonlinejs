import {
  Matrix,
  Quaternion,
  Vector3,
  BoundingBox,
  Mesh,
  type StandardMaterial,
  TransformNode,
  type Scene,
  AbstractMesh,
  Skeleton,
  AnimationGroup,
  CreateBox,
} from '../libs/babylon/exports';
import type { IVector3Like } from '../libs/babylon/exports';
// import { createMeshesForBMD } from './BMD/createMeshes';
import type { Entity, World } from '../ecs/world';
import { ENUM_WORLD } from './types';
import { loadGLTF } from './modelLoader';
import { Store } from '../store';

const BoundingUpdateInterval = 5;

type Int = number;

const EmptyBone = Matrix.Identity();
const EmptyMatrix = Matrix.Identity();
const tmpMatrix = Matrix.Identity();
const tmpQ = Quaternion.Identity();
const tmpVec3 = Vector3.Zero();
const tmpVec32 = Vector3.Zero();

const minTmp = new Vector3(Number.MAX_VALUE);
const maxTmp = new Vector3(Number.MIN_VALUE);

export class ModelObject {
  static OverrideScale = -1;

  Type: number = -1;
  WorldIndex: ENUM_WORLD = ENUM_WORLD.WD_0LORENCIA;

  HiddenMesh = -1;
  BlendMesh = -1;
  // BlendMeshState  = BlendState.Additive;
  AnimationSpeed = 4;
  BodyHeight: Float = 0;
  CurrentAction: Int = 0;
  LoopAction = true;
  LinkParent = false;
  ActionIterationWasFinished = false;
  Ready = false;
  OutOfView = false;
  Visible = true;
  Parent?: ModelObject;
  Children: ModelObject[] = [];

  SkipBoundingBox = false;

  BoundingBoxLocal = new BoundingBox(Vector3.Zero(), Vector3.Zero());

  Light = new Vector3(0, 0, 0);

  ParentBoneLink = -1;
  /** thegame: encaixe nas costas (osso, posição e rotação no espaço do osso), usado na safezone. */
  BackLink: { bone: number; position: [number, number, number]; rotation: [number, number, number] } | null = null;
  /** thegame: true quando a arma deve ficar nas costas (personagem na safezone). */
  OnBack = false;
  private _linkMode: 'hand' | 'back' | '' = '';
  protected _node: TransformNode;
  gltf: {
    mesh: AbstractMesh;
    skeleton: Skeleton;
    animationGroups: AnimationGroup[];
  } | null = null;

  NodeNamePrefix = '';

  get objectDir() {
    return `Object${this.WorldIndex + 1}/`;
  }

  constructor(
    private readonly scene: Scene,
    private readonly parent?: TransformNode
  ) {
    this._node = new TransformNode('modelObject', this.scene);
    this._node.rotationQuaternion = null;

    if (parent) {
      this._node.setParent(parent);
    }
  }

  init(_world: World, _entity: Entity): Promise<void> {
    return Promise.resolve();
  }

  playAction(actionIndex: number, loop: boolean = true) {
    if (!this.gltf) return;

    const prevAction = this.CurrentAction;
    if (prevAction === actionIndex) return;

    if (prevAction !== -1) {
      const prevAnimationGroup = this.gltf.animationGroups[prevAction];
      if (prevAnimationGroup) {
        prevAnimationGroup.stop();
      }
    }

    this.CurrentAction = actionIndex;

    const animationGroup = this.gltf.animationGroups[actionIndex];
    if (animationGroup) {
      animationGroup.speedRatio = this.AnimationSpeed / 14;
      animationGroup.play(loop);
    }
  }

  load(gltf: {
    mesh: AbstractMesh;
    skeleton: Skeleton;
    animationGroups: AnimationGroup[];
  }) {
    if (this.gltf === gltf) return;

    const oldGltf = this.gltf;
    this.gltf = gltf;
    this._node.name = this.NodeNamePrefix + gltf.mesh.name;

    if (oldGltf && oldGltf !== gltf) {
      console.log('dispose', oldGltf.mesh.name);
      oldGltf.mesh.dispose();
    }
    // console.log('load', gltf.mesh.name);

    gltf.mesh.setParent(this._node);
    gltf.mesh.position.setAll(0);
    gltf.mesh.scaling.set(1, -1, 1);
    gltf.mesh.rotationQuaternion = Quaternion.FromEulerAngles(
      -Math.PI / 2,
      0,
      0
    );

    if (this.LinkParent) {
      const parent = this.Parent;
      if (parent) {
        const parentSkeleton = parent.gltf?.skeleton;
        if (parentSkeleton) {
          this.gltf.mesh.getChildMeshes(true).forEach(mesh => {
            mesh.skeleton?.dispose();
            mesh.skeleton = parentSkeleton;
          });
        }
      }
    }

    // if (this.ParentBoneLink >= 0) {
    //   const parent = this.Parent;
    //   if (parent && parent.gltf?.skeleton) {
    //     const bone = parent.gltf.skeleton.bones[this.ParentBoneLink + 1];
    //     console.log(bone);
    //     // this._node.attachToBone(bone, bone.getTransformNode()!);
    //   }
    // }

    gltf.animationGroups.forEach(group => {
      group.speedRatio = this.AnimationSpeed / 14;
    });

    gltf.mesh.getChildMeshes(false).forEach(mesh => {
      mesh.metadata ??= {};
      mesh.metadata.SkipBoundingBox = this.SkipBoundingBox;
    });

    this.Ready = true;
  }

  setParent(parent: ModelObject): void {
    if (this.Parent) {
      // Remove from previous parent's children
      const index = this.Parent.Children.indexOf(this);
      if (index !== -1) {
        this.Parent.Children.splice(index, 1);
      }
    }

    this.Parent = parent;
    parent.Children.push(this);
  }

  getMesh(ind: number) {
    return this.gltf?.mesh.getChildMeshes(false)[ind];
  }

  getMaterial(ind: number) {
    return this.getMesh(ind)!.material as StandardMaterial;
  }

  getMeshes(recursiveWithChildren = false): Mesh[] {
    if (!this.gltf) return [];

    return this.gltf.mesh.getChildMeshes(!recursiveWithChildren);
  }

  setActionSpeed(actionType: number, speed: number) {
    // const action = this.Model?.Actions?.[actionType];
    // if (action) {
    //   action.PlaySpeed = speed;
    // }
  }

  Update(gameTime: World['gameTime']): void {
    if (!this.Ready || this.OutOfView) return;

    this.ActionIterationWasFinished = false;

    if (this.ParentBoneLink >= 0) {
      const parent = this.Parent;
      if (parent && parent.gltf?.skeleton && this.gltf) {
        // thegame: na safezone a arma vai para as costas (BackLink), fora dela fica na mão.
        const back = this.OnBack ? this.BackLink : null;
        const boneIndex = back ? back.bone : this.ParentBoneLink;
        const bone = parent.gltf.skeleton.bones[boneIndex + 1];
        const node = bone?.getTransformNode();
        const mode = back ? 'back' : 'hand';
        if (node && (this._node.parent !== node || this._linkMode !== mode)) {
          this._linkMode = mode;
          this._node.setParent(node);
          // O modelo convertido tem na raiz uma correção de eixos (gira -90° em X e espelha Y).
          // O osso já está no espaço do MU, então o encaixe aplica o inverso exato dessa
          // correção (antes era uma rotação fixa de 270°, que deixava a arma atravessada).
          // Nas costas, soma a posição/inclinação do BackLink no espaço do osso.
          const root = this.gltf.mesh;
          let local = Matrix.Compose(
            root.scaling,
            root.rotationQuaternion ?? Quaternion.FromEulerVector(root.rotation),
            root.position
          ).invert();
          if (back) {
            local = local.multiply(
              Matrix.Compose(
                Vector3.One(),
                Quaternion.FromEulerAngles(back.rotation[0], back.rotation[1], back.rotation[2]),
                new Vector3(back.position[0], back.position[1], back.position[2])
              )
            );
          }
          const scaling = new Vector3();
          const rotation = new Quaternion();
          const position = new Vector3();
          local.decompose(scaling, rotation, position);
          this._node.scaling.copyFrom(scaling);
          this._node.rotationQuaternion = rotation;
          this._node.position.copyFrom(position);
        }
      }
    }
  }

  Draw(_gameTime: World['gameTime']): void {
    if (!this.Visible) return;

    this.getMeshes().forEach((_, i) => {
      this.DrawMesh(i);
    });
  }

  DrawMesh(mesh: Int): void {
    if (this.HiddenMesh === mesh) return;
  }

  UpdateBoundings() {
    if (!this.gltf) return;

    this._node.getChildMeshes(false).forEach(mesh => {
      mesh.refreshBoundingInfo(true, false);
    });

    const boundingBox = this._node.getHierarchyBoundingVectors(true, m => {
      return !m.metadata?.SkipBoundingBox;
    });

    this.BoundingBoxLocal.minimumWorld.copyFrom(boundingBox.min);
    this.BoundingBoxLocal.maximumWorld.copyFrom(boundingBox.max);
  }

  updateLocation(pos: IVector3Like, scale: Float, angles: IVector3Like) {
    this._node.position.set(pos.x, pos.y, pos.z);

    this._node.rotation.x = angles.x;
    this._node.rotation.y = angles.y;
    this._node.rotation.z = angles.z;

    this._node.scaling.setAll(scale);
  }

  Unload() {
    this.Ready = false;
  }

  dispose(): void {
    this._node.dispose();
    if (this.gltf) {
      this.gltf.mesh.dispose(false, true);
      this.gltf.skeleton?.dispose();
      this.gltf.animationGroups.forEach(group => {
        group.dispose();
      });
      this.gltf = null;
    }

    this.Ready = false;

    for (const child of this.Children) {
      child.dispose();
    }

    this.Children.length = 0;
  }

  protected async loadSpecificModel(modelName: string) {
    this.load(await loadGLTF(`${this.objectDir}${modelName}`, Store.world!));
  }

  protected async loadSpecificModelWithDynamicID(
    modelId: number,
    namePrefix: string
  ) {
    const idx = (this.Type - modelId + 1).toString().padStart(2, '0');
    const name = `${namePrefix}${idx}.glb`;
    await this.loadSpecificModel(name);
  }
}
