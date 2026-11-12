import {
  BoundingBox,
  Vector3,
  type Scene,
  type TransformNode,
} from '../libs/babylon/exports';
import { ModelObject } from './modelObject';
import type { IVector3Like } from '../libs/babylon/exports';
import { PlayerClass } from './types';
import { Entity, World } from '../ecs/world';
import { PlayerAction } from './objects/enum';
import { TWFlags } from './terrain/consts';
import { applyAdditiveToEffectMeshes, attachLooseGlbImages, loadGLTF } from './modelLoader';
import { Store } from '../store';

/**
 * Ajuste extra da altura do corpo sobre a montaria. Fica em 0: as animações de montado
 * (PLAYER_STOP_RIDE etc.) já levantam o corpo até a sela (quadril ~1,4 acima do chão).
 */
const MOUNT_RIDE_HEIGHT = 0;

export class PlayerObject extends ModelObject {
  playerClass: PlayerClass = PlayerClass.DarkKnight;

  readonly HelmMask: ModelObject;
  readonly Helm: ModelObject;
  readonly Armor: ModelObject;
  readonly Pants: ModelObject;
  readonly Gloves: ModelObject;
  readonly Boots: ModelObject;
  readonly Weapon1: ModelObject;
  readonly Weapon2: ModelObject;
  readonly Wings: ModelObject;
  /** thegame: montaria (Uniria / Dinorant), presa à posição do personagem, no chão. */
  readonly Mount: ModelObject;
  /** Número do pet montado (13/2 Uniria, 13/3 Dinorant) ou null. */
  MountNumber: number | null = null;
  private _mountLoading: number | null = null;

  IsInteractable = false;

  constructor(scene: Scene, parent: TransformNode) {
    super(scene, parent);

    this.BoundingBoxLocal = new BoundingBox(
      new Vector3(-0.4, 0, -0.4),
      new Vector3(0.4, 1.2, 0.4)
    );

    this.CurrentAction = PlayerAction.PLAYER_SKILL_INFERNO;

    this.HelmMask = new ModelObject(scene, this._node);
    this.Helm = new ModelObject(scene, this._node);
    this.Armor = new ModelObject(scene, this._node);
    this.Pants = new ModelObject(scene, this._node);
    this.Gloves = new ModelObject(scene, this._node);
    this.Boots = new ModelObject(scene, this._node);
    this.Weapon1 = new ModelObject(scene, this._node);
    this.Weapon2 = new ModelObject(scene, this._node);
    this.Wings = new ModelObject(scene, this._node);
    this.Mount = new ModelObject(scene, parent);
    this.Mount.NodeNamePrefix = 'Mount_';

    this.HelmMask.NodeNamePrefix = 'HelmMask_';
    this.Helm.NodeNamePrefix = 'Helm_';
    this.Armor.NodeNamePrefix = 'Armor_';
    this.Pants.NodeNamePrefix = 'Pants_';
    this.Gloves.NodeNamePrefix = 'Gloves_';
    this.Boots.NodeNamePrefix = 'Boots_';
    this.Weapon1.NodeNamePrefix = 'Weapon1_';
    this.Weapon2.NodeNamePrefix = 'Weapon2_';
    this.Wings.NodeNamePrefix = 'Wings_';

    const objs = [
      this.HelmMask,
      this.Helm,
      this.Armor,
      this.Pants,
      this.Gloves,
      this.Boots,
      this.Weapon1,
      this.Weapon2,
      this.Wings,
    ];

    objs.forEach(obj => {
      obj.setParent(this);
      obj.LinkParent = true;
    });

    this.Wings.LinkParent = false;
    this.Wings.ParentBoneLink = 47;
    this.Wings.SkipBoundingBox = true;
    this.Weapon1.SkipBoundingBox = true;
    this.Weapon2.SkipBoundingBox = true;
    this.HelmMask.SkipBoundingBox = true;
    this.Pants.SkipBoundingBox = true;
    this.Gloves.SkipBoundingBox = true;
    this.Helm.SkipBoundingBox = true;

    // 37 - l hand(0>2>17>18>19>34>35>36)
    // 42 -l hand slot

    // 28 - r hand
    // 33 - r kine
    // thegame: como no cliente original (MuMain), arma da direita no osso 33 ("knife") e
    // arma/escudo da esquerda no osso 42 ("hand"). As armas têm esqueleto próprio: não podem
    // usar o do personagem (LinkParent), senão o desenho é deslocado pelos ossos do corpo.
    this.Weapon1.LinkParent = false;
    this.Weapon1.ParentBoneLink = 33;
    this.Weapon2.LinkParent = false;
    this.Weapon2.ParentBoneLink = 42;
    // Na safezone, como no MU, as armas ficam guardadas nas costas (osso Spine1): deitadas
    // na diagonal e coladas nas costas. Arma da esquerda (escudo, arco, 2ª arma): cabo atrás
    // do ombro esquerdo, ponta no quadril direito; a da direita, espelhada. Valores calculados
    // medindo o corpo (neste osso: X = para cima, Y = para trás, Z = para o lado).
    this.Weapon1.BackLink = { bone: 18, position: [0.307, -0.187, -0.103], rotation: [0, 0.394, -1.562] };
    this.Weapon2.BackLink = { bone: 18, position: [0.307, -0.17, 0.098], rotation: [0, 2.749, 1.571] };
  }

  private _entity?: Entity;
  private _world?: World;

  async init(world: World, entity: Entity) {
    this._entity = entity;
    this._world = world;
    await super.init(world, entity);

    this.load(await loadGLTF('Player/player.glb', world));
    this.Ready = false;
    await this.updateBodyPartClassesAsync();

    this.setActionSpeed(PlayerAction.PLAYER_WALK_MALE, 2);
    this.setActionSpeed(PlayerAction.PLAYER_WALK_FEMALE, 2);

    this.Ready = true;
  }

  async updateBodyPartClassesAsync() {
    await this.setBodyPartsAsync(
      'Player/',
      'HelmClass',
      'ArmorClass',
      'PantClass',
      'GloveClass',
      'BootClass',
      this.playerClass
    );

    // await this.loadPartAsync('Item/', this.Wings, `Wing04.glb`);
    // const wingMat = this.Wings.getMaterial(0);
    // if (wingMat) {
    //   wingMat.alpha = 0.99;
    //   wingMat.alphaMode = 1;
    //   wingMat.transparencyMode = 2;
    //   wingMat.backFaceCulling = false;
    // }
  }

  async setDefaultHelm() {
    await this.setBodyPartsAsync(
      'Player/',
      'HelmClass',
      '',
      '',
      '',
      '',
      this.playerClass
    );
  }

  async setDefaultMask() {
    this.HelmMask.Unload();
  }

  async setDefaultArmor() {
    await this.setBodyPartsAsync(
      'Player/',
      '',
      'ArmorClass',
      '',
      '',
      '',
      this.playerClass
    );
  }

  async setDefaultPants() {
    await this.setBodyPartsAsync(
      'Player/',
      '',
      '',
      'PantClass',
      '',
      '',
      this.playerClass
    );
  }

  async setDefaultGloves() {
    await this.setBodyPartsAsync(
      'Player/',
      '',
      '',
      '',
      'GloveClass',
      '',
      this.playerClass
    );
  }

  async setDefaultBoots() {
    await this.setBodyPartsAsync(
      'Player/',
      '',
      '',
      '',
      '',
      'BootClass',
      this.playerClass
    );
  }

  async setBodyPartsAsync(
    pathPrefix: string,
    helmPrefix: string,
    armorPrefix: string,
    pantPrefix: string,
    glovePrefix: string,
    bootPrefix: string,
    skinIndex: number
  ) {
    // Format skin index to two digits (e.g., 1 -> "01", 10 -> "10")
    const fileSuffix = skinIndex.toString().padStart(2, '0');

    await Promise.all([
      !helmPrefix
        ? Promise.resolve()
        : this.loadPartAsync(
            pathPrefix,
            this.Helm,
            `${helmPrefix}${fileSuffix}.glb`
          ),
      !armorPrefix
        ? Promise.resolve()
        : this.loadPartAsync(
            pathPrefix,
            this.Armor,
            `${armorPrefix}${fileSuffix}.glb`
          ),
      !pantPrefix
        ? Promise.resolve()
        : this.loadPartAsync(
            pathPrefix,
            this.Pants,
            `${pantPrefix}${fileSuffix}.glb`
          ),
      !glovePrefix
        ? Promise.resolve()
        : this.loadPartAsync(
            pathPrefix,
            this.Gloves,
            `${glovePrefix}${fileSuffix}.glb`
          ),
      !bootPrefix
        ? Promise.resolve()
        : this.loadPartAsync(
            pathPrefix,
            this.Boots,
            `${bootPrefix}${fileSuffix}.glb`
          ),
    ]);
  }

  async loadPartAsync(
    dir: string,
    part: ModelObject,
    modelPath: string,
    itemLvl?: number,
    isExcellent?: boolean
  ) {
    const gltf = await loadGLTF(dir + modelPath, Store.world!);
    part.load(gltf);

    gltf.mesh.isPickable = this.IsInteractable;
    const meshes = part.getMeshes(true);

    meshes.forEach(mesh => {
      mesh.isPickable = this.IsInteractable;
      mesh.metadata ??= {};
      mesh.metadata.itemLvl = itemLvl ?? 0;
      mesh.metadata.isExcellent = isExcellent ?? false;
    });

    // thegame: fogo/brilho de armas e asas com fundo preto → aditivo, como no MU.
    if (part === this.Weapon1 || part === this.Weapon2 || part === this.Wings) {
      await applyAdditiveToEffectMeshes(Store.world!.scene, meshes);
    }
  }

  /** thegame: monta (13/2 Uniria, 13/3 Dinorant) ou desmonta (null). */
  async setMountAsync(petNumber: number | null) {
    const model = petNumber === 2 ? 'Rider01.glb' : petNumber === 3 ? 'Rider02.glb' : null;
    const wanted = model ? petNumber : null;
    if (wanted !== null && wanted === this._mountLoading) return; // já está carregando esta
    if (wanted === this.MountNumber && this._mountLoading === null) return; // nada mudou

    if (!model) {
      this.MountNumber = null;
      this._mountLoading = null;
      this.Mount.gltf?.mesh.setEnabled(false);
      return;
    }

    this._mountLoading = wanted;
    const gltf = await loadGLTF('Skill/' + model, Store.world!);
    if (this._mountLoading !== wanted) return; // trocou de novo enquanto carregava
    this.Mount.load(gltf);
    await attachLooseGlbImages(Store.world!.scene, 'Skill/' + model, gltf.mesh.getChildMeshes());
    gltf.mesh.setEnabled(true);
    gltf.mesh.isPickable = this.IsInteractable;
    gltf.mesh.getChildMeshes().forEach(m => (m.isPickable = this.IsInteractable));
    this.Mount.AnimationSpeed = 6;
    this.Mount.CurrentAction = -1;
    this.Mount.playAction(0);
    this.MountNumber = wanted;
    this._mountLoading = null;
  }

  /** thegame: montado, o corpo sobe e a montaria acompanha a posição/rotação no chão. */
  updateLocation(pos: IVector3Like, scale: number, angles: IVector3Like) {
    const mounted = this.MountNumber !== null;
    super.updateLocation(mounted ? { x: pos.x, y: pos.y + MOUNT_RIDE_HEIGHT, z: pos.z } : pos, scale, angles);
    if (mounted) this.Mount.updateLocation(pos, scale, angles);
  }

  /** Animação da montaria: parada ou andando. */
  setMountMoving(moving: boolean) {
    if (this.MountNumber === null || !this.Mount.gltf) return;
    const groups = this.Mount.gltf.animationGroups.length;
    const action = moving && groups > 1 ? 1 : 0;
    this.Mount.playAction(action);
  }

  Update(gameTime: World['gameTime']): void {
    super.Update(gameTime);

    // thegame: arma nas costas enquanto o personagem está na safezone.
    // Lê a marca de safezone do chão onde o personagem está (a marca 'inSafeZone' do
    // personagem só é atualizada ao andar, e ficava velha depois de um teleporte).
    const pos = this._entity?.transform?.pos;
    const flag = pos && this._world ? this._world.getTerrainFlag(Math.round(pos.x), Math.round(pos.z)) : 0;
    const onBack = (flag & TWFlags.SafeZone) !== 0;
    this.Weapon1.OnBack = onBack;
    this.Weapon2.OnBack = onBack;

    // Update all children
    for (const child of this.Children) {
      child.Update(gameTime);
    }
  }

  Draw(gameTime: World['gameTime']): void {
    super.Draw(gameTime);

    // Update all children
    for (const child of this.Children) {
      child.Draw(gameTime);
    }
  }
}
