import { type Bucket, World as ECSWorld } from 'miniplex';
import type { IVector2Like, IVector3Like, Mesh } from '../libs/babylon/exports';
import type { ModelObject } from '../common/modelObject';
import type { MonsterActionType, PlayerAction } from '../common/objects/enum';
import type { MUAttributeSystem } from '../libs/attributeSystem';
import { TransformNode } from '../libs/babylon/exports';
import { createPathfinding } from '../libs/pathfinding';
import { CharacterClassNumber, ENUM_WORLD } from '../common';
import { AssetsManager, Color3, Viewport } from '../libs/babylon/exports';
import type { HighlightLayer } from '../libs/babylon/exports';
import type { TestScene } from '../scenes/testScene';

export type EntityTypeFromQuery<TB extends Bucket<any> = Bucket<any>> =
  TB extends Bucket<infer T> ? T : never;

export type ISystemFactory = (world: World) => {
  update?: (deltaTime: number) => void;
};

export type Item = {
  num: number;
  group: number;
  lvl?: number;
  isExcellent?: boolean;
  hasSkill?: boolean;
  /** thegame: opções lidas dos 12 bytes do item (ItemSerializer.DeserializeItem). */
  hasLuck?: boolean;
  /** Nível do adicional (0–7): +4 de dano/defesa por nível, ou % de recuperação em anéis/colares. */
  optionLevel?: number;
  /** Bits das opções excelentes (0..63). */
  excellentBits?: number;
  durability?: number;
  isAncient?: boolean;
};

export type Entity = Partial<{
  netId: number;
  modelId: number;
  worldIndex: ENUM_WORLD;
  modelFilePath: string;
  npcType: number;
  localPlayer: true;
  transform: {
    pos: IVector3Like;
    rot: IVector3Like;
    scale: number;
    posOffset?: IVector3Like;
  };
  modelObject: ModelObject;
  modelFactory: typeof ModelObject;
  objOutOfScope: true;
  pathfinding: {
    from: IVector2Like;
    to: IVector2Like;
    path: IVector2Like[] | null;
    calculated: boolean;
  };
  playerMoveTo: {
    point: IVector2Like;
    handled: boolean;
    sendToServer?: boolean;
  };
  movement: {
    velocity: IVector2Like;
  };
  playerAnimation: {
    action: PlayerAction;
    /** thegame: até este instante (gameTime em s) a animação atual não é recalculada (ex.: ataque). */
    lockedUntil?: number;
  };
  /** thegame: objeto morto (ObjectGotKilled); não pode ser atacado e mantém a animação de morte. */
  dead: true;
  /** thegame: item (ou zen) caído no chão, que pode ser pego (C3 22 PickupItemRequest). */
  groundItem: { isMoney: boolean };
  monsterAnimation: {
    action: MonsterActionType;
    /** thegame: até este instante (gameTime em s) ataque/golpe não volta para parado. */
    lockedUntil?: number;
  };
  attributeSystem: MUAttributeSystem;
  visibility: {
    state: 'visible' | 'nearby' | 'hidden';
    lastChecked: number;
  };
  screenPosition: {
    x: number;
    y: number;
    worldOffsetZ: number;
  };
  objectNameInWorld: string;
  charAppearance: {
    helm: Item | null;
    armor: Item | null;
    pants: Item | null;
    gloves: Item | null;
    boots: Item | null;
    leftHand: Item | null;
    rightHand: Item | null;
    wings: Item | null;
    /** thegame: pet/montaria do slot 8 (grupo 13: 0 Anjo, 1 Imp, 2 Uniria, 3 Dinorant). */
    pet?: Item | null;
    charClass: CharacterClassNumber;
    changed: boolean;
  };
  highlighted: {
    color: Color3;
    layer: HighlightLayer | null;
  };
  interactable: true;
  keyboardInput: {
    pressedKeys: Set<string>;
  };
  interactiveArea: {
    min: IVector2Like;
    max: IVector2Like;
    inside?: boolean;
    onEnter?: () => void;
    onLeave?: () => void;
  };
  onDispose?: () => void;
}>;

export class World extends ECSWorld<Entity> {
  readonly terrainScale = 100;

  viewport = new Viewport(0, 0, 1, 1);

  readonly gameTime = { TotalGameTime: { TotalSeconds: 0.1 } };

  readonly mapParent: TransformNode;

  readonly netObjsQuery = this.with('netId', 'transform');

  readonly playersQuery = this.with(
    'attributeSystem',
    'transform',
    'playerAnimation',
    'playerMoveTo',
    'pathfinding'
  );

  #localPlayerQuery = this.playersQuery.with('localPlayer');

  get playerEntity() {
    return this.#localPlayerQuery.entities[0];
  }

  #keyboardInputQuery = this.with('keyboardInput');

  get keyboardInput() {
    return this.#keyboardInputQuery.entities[0].keyboardInput;
  }

  mapIndex = ENUM_WORLD.WD_55LOGINSCENE;

  terrain: {
    mesh: Mesh;
    MapTileObjects: (typeof ModelObject)[];
    extraHeight: number;
  } | null = null;

  readonly pathfinder = createPathfinding({
    width: 256,
    height: 256,
  });

  readonly assetsManager: AssetsManager;

  currentPointerTarget: Entity | null = null;
  /** thegame: netId do monstro que o jogador local está atacando (null = nenhum). */
  attackTargetNetId: number | null = null;
  /** thegame: habilidade a usar (botão direito). Alvo = monstro (targetNetId) ou ponto (x, y). */
  pendingSkill: { number: number; targetNetId: number | null; x: number; y: number } | null = null;
  /** thegame: netId do item no chão que o jogador local vai pegar (null = nenhum). */
  pickupTargetNetId: number | null = null;
  /** thegame: NPC com quem o jogador quer falar (anda até ele e manda C3 30). */
  talkTargetNetId: number | null = null;

  pointerPressed = false;

  constructor(readonly scene: TestScene) {
    super();

    this.add({
      keyboardInput: {
        pressedKeys: new Set(),
      },
    });

    this.assetsManager = new AssetsManager(this.scene);
    this.assetsManager.useDefaultLoadingScreen = false;

    this.mapParent = new TransformNode('mapParent', scene);
  }

  getTerrainHeight(x: number, y: number): number {
    return -9999;
  }

  isWalkable(x: number, y: number): boolean {
    return true;
  }

  getTerrainFlag(x: number, y: number): number {
    return 0;
  }

  getTerrainTile(x: number, y: number): number {
    return 0;
  }
}
