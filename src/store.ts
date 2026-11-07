import {
  CharacterClassNumber,
  ENUM_WORLD,
  SimpleModulusEncryptor,
  Xor32Encryptor,
  Xor3Byte,
} from './common';
import {
  CreateCharacterPacket,
  FocusCharacterPacket,
  LoginShortPasswordPacket,
  RequestCharacterListPacket,
  SelectCharacterPacket,
  WalkRequestPacket,
} from './common/packets/ClientToServerPackets';
import {
  ConnectionInfoRequestPacket,
  ServerListRequestPacket,
  ServerListResponsePacket,
} from './common/packets/ConnectServerPackets';
import { CharacterListPacket } from './common/packets/ServerToClientPackets';
import { stringToBytes } from './common/utils';
import {
  CLIENT_VERSION,
  CS_HOST,
  CS_PORT,
  MAX_PASSWORD_LENGTH,
  MAX_USERNAME_LENGTH,
  WS_HOST,
  WS_PORT,
} from './consts';
import { LocalStorage } from './libs/localStorage';
import { createSocket } from './libs/sockets/createSocket';
import {
  makeObservable,
  observable,
  action,
  remove,
  runInAction,
  computed,
} from 'mobx';
import { Item, World } from './ecs/world';
import { EventBus } from './libs/eventBus';
import { Scalar } from './libs/babylon/exports';
import { InventoryConstants } from './common/inventoryConstants';
import { ItemGroups } from './common/objects/enum';
import { ItemsDatabase } from './common/itemsDatabase';
import { spawnPlayer } from './logic';

const CONFIG_KEY = '_mu_key';

const xor32 = new Xor32Encryptor();

type ConfigType = {
  csIp?: string;
  csPort?: number;
  wsHost?: string;
  wsPort?: number;
  username?: string;
  password?: string;
};

export enum UIState {
  Preloader,
  Servers,
  Login,
  Characters,
  LoadingWorld,
  World,
}

class ActionBarSlot {
  itemId = 0;
  count = 0;
}

class ActionBar {
  q: ActionBarSlot | null = null;
  w: ActionBarSlot | null = null;
  e: ActionBarSlot | null = null;
  r: ActionBarSlot | null = null;

  num6: ActionBarSlot | null = null;
  num7: ActionBarSlot | null = null;
  num8: ActionBarSlot | null = null;
  num9: ActionBarSlot | null = null;
  num0: ActionBarSlot | null = null;

  selectedSkill = -1;

  constructor() {
    makeObservable(this, {
      q: observable,
      w: observable,
      e: observable,
      r: observable,
      num6: observable,
      num7: observable,
      num8: observable,
      num9: observable,
      num0: observable,
      selectedSkill: observable,
    });
  }
}

class PlayerData {
  money = 0;
  x = 0;
  y = 0;

  tileFlag = 0;

  actionBar = new ActionBar();

  currentHP = 25;
  maxHP = 40;
  currentMP = 80;
  maxMP = 100;
  currentSD = 10;
  maxSD = 12;
  currentAG = 10;
  maxAG = 12;

  level = 1;
  points = 5;

  exp = 50;
  currentLvlExp = 0;
  expToNextLvl = 100;

  str = 10;
  agi = 10;
  sta = 10;
  eng = 10;

  items: Item[] = new Array(
    InventoryConstants.InventoryRows * InventoryConstants.RowSize +
      InventoryConstants.EquippableSlotsCount
  ).fill(null);

  get leftHandSlot() {
    return this.items[InventoryConstants.LeftHandSlot];
  }

  get rightHandSlot() {
    return this.items[InventoryConstants.RightHandSlot];
  }

  get helmetSlot() {
    return this.items[InventoryConstants.HelmSlot];
  }

  get glovesSlot() {
    return this.items[InventoryConstants.GlovesSlot];
  }

  get bootsSlot() {
    return this.items[InventoryConstants.BootsSlot];
  }

  get pantsSlot() {
    return this.items[InventoryConstants.PantsSlot];
  }

  get armorSlot() {
    return this.items[InventoryConstants.ArmorSlot];
  }

  get wingsSlot() {
    return this.items[InventoryConstants.WingsSlot];
  }

  get pendantSlot() {
    return this.items[InventoryConstants.PendantSlot];
  }

  get ring1Slot() {
    return this.items[InventoryConstants.Ring1Slot];
  }

  get ring2Slot() {
    return this.items[InventoryConstants.Ring2Slot];
  }

  get petSlot() {
    return this.items[InventoryConstants.PetSlot];
  }

  get inventoryItems() {
    return this.items.slice(
      InventoryConstants.LastEquippableItemSlotIndex + 1,
      InventoryConstants.LastEquippableItemSlotIndex +
        1 +
        InventoryConstants.InventoryRows * InventoryConstants.RowSize
    );
  }

  get hpPercent() {
    return Scalar.Clamp(this.currentHP / Math.max(this.maxHP, 1), 0, 1);
  }

  get mpPercent() {
    return Scalar.Clamp(this.currentMP / Math.max(this.maxMP, 1), 0, 1);
  }

  get sdPercent() {
    return Scalar.Clamp(this.currentSD / Math.max(this.maxSD, 1), 0, 1);
  }

  get agPercent() {
    return Scalar.Clamp(this.currentAG / Math.max(this.maxAG, 1), 0, 1);
  }

  get expPercent() {
    return Scalar.Clamp(
      (this.exp - this.currentLvlExp) /
        Math.max(this.expToNextLvl - this.currentLvlExp, 1),
      0,
      1
    );
  }

  constructor() {
    makeObservable(this, {
      money: observable,
      x: observable,
      y: observable,
      tileFlag: observable,
      actionBar: observable,
      currentHP: observable,
      maxHP: observable,
      currentMP: observable,
      maxMP: observable,
      currentSD: observable,
      maxSD: observable,
      currentAG: observable,
      maxAG: observable,
      exp: observable,
      currentLvlExp: observable,
      expToNextLvl: observable,
      expPercent: computed,
      hpPercent: computed,
      mpPercent: computed,
      sdPercent: computed,
      agPercent: computed,
      str: observable,
      agi: observable,
      sta: observable,
      eng: observable,
      level: observable,
      points: observable,
      items: observable,
      leftHandSlot: computed,
      rightHandSlot: computed,
      helmetSlot: computed,
      glovesSlot: computed,
      bootsSlot: computed,
      pantsSlot: computed,
      armorSlot: computed,
      wingsSlot: computed,
      pendantSlot: computed,
      ring1Slot: computed,
      ring2Slot: computed,
      petSlot: computed,
      inventoryItems: computed,
    });
  }

  setPosition(x: number, y: number) {
    runInAction(() => {
      this.x = x;
      this.y = y;
    });
  }

  setTileFlag(flag: number) {
    runInAction(() => {
      this.tileFlag = flag;
    });
  }
}

export type NotificationType = 'info' | 'error';

export type Notification = {
  text: string;
  type: NotificationType;
};

export const Store = new (class _Store {
  csSocket?: WebSocket;
  gsSocket?: WebSocket;

  private encryptor?: SimpleModulusEncryptor;

  username = '';
  password = '';
  serverList: ReturnType<ServerListResponsePacket['getServers']> = [];
  charactersList: ReturnType<CharacterListPacket['getCharacters']> = [];
  uiState = UIState.Preloader;
  playerId?: number;

  loginProcessing = false;
  loginError?: string;

  loadingCharactersList = false;
  newCharName: string = '';
  newCharClass: CharacterClassNumber = CharacterClassNumber.DarkKnight;
  focusedChar: string = '';
  /** Classes extras liberadas para a conta (CharacterCreationUnlockFlagsEnum). */
  unlockFlags = 0;
  characterCreationError?: string;
  characterCreationProcessing = false;

  playerData = new PlayerData();

  characterInfoEnabled = false;
  inventoryEnabled = false;

  config: ConfigType = {
    csIp: CS_HOST,
    csPort: CS_PORT,
    wsHost: WS_HOST,
    wsPort: WS_PORT,
  };

  notifications: Notification[] = [];

  world: World | null = null;

  isOffline = location.href.includes('offline');

  constructor() {
    makeObservable(this, {
      username: observable,
      password: observable,
      serverList: observable,
      uiState: observable,
      playerId: observable,
      loginError: observable,
      loginProcessing: observable,
      charactersList: observable,
      loadingCharactersList: observable,
      newCharName: observable,
      newCharClass: observable,
      focusedChar: observable,
      unlockFlags: observable,
      characterCreationError: observable,
      characterCreationProcessing: observable,
      playerData: observable,
      notifications: observable,
      world: observable,
      characterInfoEnabled: observable,
      inventoryEnabled: observable,
    });
    this.loadConfig();
  }

  playOffline() {
    if (!this.world) return;

    history.replaceState(null, '', '/offline');
    this.isOffline = true;
    this.uiState = UIState.World;
    this.setTestItems();

    const testPlayer = spawnPlayer(this.world);
    this.world.addComponent(testPlayer, 'localPlayer', true);
    this.world.addComponent(testPlayer, 'worldIndex', ENUM_WORLD.WD_0LORENCIA);
    testPlayer.objectNameInWorld = 'TestPlayer';
    EventBus.emit('requestWarp', { map: ENUM_WORLD.WD_0LORENCIA });
  }

  playOnline() {
    this.uiState = UIState.Servers;

    this.connectToConnectServer();
  }

  setTestItems() {
    const DragonSetIndex = 1;

    Store.playerData.items[InventoryConstants.HelmSlot] = {
      num: DragonSetIndex,
      group: ItemGroups.Helm,
      lvl: 9,
      isExcellent: false,
    };

    Store.playerData.items[InventoryConstants.ArmorSlot] = {
      num: DragonSetIndex,
      group: ItemGroups.Armor,
      lvl: 7,
      isExcellent: false,
    };

    Store.playerData.items[InventoryConstants.PantsSlot] = {
      num: DragonSetIndex,
      group: ItemGroups.Pants,
      lvl: 9,
      isExcellent: false,
    };

    Store.playerData.items[InventoryConstants.GlovesSlot] = {
      num: DragonSetIndex,
      group: ItemGroups.Gloves,
      lvl: 5,
      isExcellent: false,
    };

    Store.playerData.items[InventoryConstants.BootsSlot] = {
      num: DragonSetIndex,
      group: ItemGroups.Boots,
      lvl: 1,
      isExcellent: false,
    };

    const weapon = ItemsDatabase.getItem(3, 9); // bill spear
    // const weapon = ItemsDatabase.getItem(1, 1); // small axe

    Store.playerData.items[InventoryConstants.LeftHandSlot] = {
      group: weapon.Group,
      num: weapon.Index,
      lvl: 9,
      isExcellent: false,
    };

    Store.playerData.items[InventoryConstants.LastEquippableItemSlotIndex + 1] =
      {
        group: weapon.Group,
        num: weapon.Index,
        lvl: 9,
        isExcellent: true,
      };

    this.syncPlayerAppearance();
  }

  syncPlayerAppearance() {
    const playerData = this.playerData;
    const playerEntity = this.world?.playerEntity;

    if (!playerEntity || !playerEntity.charAppearance) return;

    playerEntity.charAppearance.helm = playerData.helmetSlot || null;
    playerEntity.charAppearance.armor = playerData.armorSlot || null;
    playerEntity.charAppearance.pants = playerData.pantsSlot || null;
    playerEntity.charAppearance.gloves = playerData.glovesSlot || null;
    playerEntity.charAppearance.boots = playerData.bootsSlot || null;
    playerEntity.charAppearance.leftHand = playerData.leftHandSlot || null;
    playerEntity.charAppearance.rightHand = playerData.rightHandSlot || null;
    playerEntity.charAppearance.wings = playerData.wingsSlot || null;
    playerEntity.charAppearance.changed = true;
  }

  private loadConfig(): void {
    const data = JSON.parse(
      LocalStorage.load(CONFIG_KEY) ?? '{}'
    ) as ConfigType;
    if (data) {
      Object.assign(this.config, data);
    }

    this.username = this.config.username ?? '';

    // thegame: a senha não é mais guardada no navegador. Apaga a de versões antigas.
    if (this.config.password !== undefined) {
      delete this.config.password;
      this.saveConfig();
    }
  }

  saveConfig(): void {
    LocalStorage.save(CONFIG_KEY, JSON.stringify(this.config));
  }

  saveLoginData(): void {
    const c = this.config;
    c.username = this.username;
    // thegame: só o nome de usuário é guardado; a senha nunca vai para o navegador.
    this.saveConfig();
  }

  addNotification(text: string, type: NotificationType = 'info', delay = 3000) {
    const newNotification: Notification = { text, type };

    this.notifications.push(newNotification);

    setTimeout(
      action(() =>
        remove(
          this.notifications,
          this.notifications.indexOf(newNotification) as any
        )
      ),
      delay
    );
  }

  sendToCS(buffer: DataView) {
    this.csSocket?.send(buffer);
  }

  sendToGS(buffer: DataView) {
    let packet = new Uint8Array(buffer.buffer);

    const header = packet[0];
    xor32.Encrypt(packet);
    if (this.encryptor && header >= 0xc3) {
      packet = this.encryptor.Encrypt(packet);
    }

    this.gsSocket?.send(packet);
  }

  async connectToConnectServer() {
    const config = this.config;

    const { socket } = createSocket({
      wsAddress: `${config.wsHost ?? WS_HOST}:${config.wsPort ?? WS_PORT}`,
      tcpIP: config.csIp ?? CS_HOST,
      tcpPort: config.csPort ?? CS_PORT,
    });

    this.csSocket = socket;
  }

  async disconnectFromConnectServer() {
    this.csSocket?.close();
    this.csSocket = undefined;
  }

  async connectToGameServer(ip: string, port: number) {
    const config = this.config;

    const { socket } = createSocket({
      wsAddress: `${config.wsHost ?? WS_HOST}:${config.wsPort ?? WS_PORT}`,
      tcpIP: ip,
      tcpPort: port,
    });

    this.gsSocket = socket;

    this.encryptor = new SimpleModulusEncryptor();
    this.encryptor.encryptionKeys = SimpleModulusEncryptor.DefaultClientKey;
  }

  async disconnectFromGameServer() {
    this.gsSocket?.close();
    this.gsSocket = undefined;
  }

  updateServerListRequest(): void {
    const buffer = ServerListRequestPacket.createPacket().buffer;
    this.sendToCS(buffer);
  }

  getConnectionInfoRequest(serverId: number): void {
    const connectionInfoRequestPacket =
      ConnectionInfoRequestPacket.createPacket();
    connectionInfoRequestPacket.ServerId = serverId;

    this.sendToCS(connectionInfoRequestPacket.buffer);
  }

  loginRequest(username: string, password: string) {
    const usernameBytes = stringToBytes(username, MAX_USERNAME_LENGTH);
    const passwordBytes = stringToBytes(password, MAX_PASSWORD_LENGTH);

    Xor3Byte(usernameBytes);
    Xor3Byte(passwordBytes);

    const loginShortPasswordPacket = LoginShortPasswordPacket.createPacket();
    loginShortPasswordPacket.setUsername(usernameBytes, usernameBytes.length);
    loginShortPasswordPacket.setPassword(passwordBytes, passwordBytes.length);
    loginShortPasswordPacket.setClientVersion(CLIENT_VERSION);

    console.log(`send login`);
    this.sendToGS(loginShortPasswordPacket.buffer);
  }

  refreshCharactersListRequest(): void {
    this.loadingCharactersList = true;
    const packet = RequestCharacterListPacket.createPacket();
    packet.Language = 0; // TODO
    this.sendToGS(packet.buffer);
  }

  focusCharacterRequest(name: string): void {
    const packet = FocusCharacterPacket.createPacket();
    packet.setName(name);
    this.sendToGS(packet.buffer);
  }

  selectCharacterRequest(name: string): void {
    const selectCharacterPacket = SelectCharacterPacket.createPacket();
    selectCharacterPacket.setName(name);

    console.log(`select character [${name}]`);
    this.sendToGS(selectCharacterPacket.buffer);
  }

  createCharacterRequest(name: string, charClass: CharacterClassNumber): void {
    const packet = CreateCharacterPacket.createPacket();
    packet.setName(name);
    packet.Class = charClass;

    this.sendToGS(packet.buffer);
  }

  sendWalkPath(x: number, y: number, dirs: number[]): void {
    const packet = WalkRequestPacket.createPacket(6 + dirs.length);
    packet.SourceX = x;
    packet.SourceY = y;
    packet.StepCount = dirs.length;

    function SetStepData(steps: number[], stepsSize: number) {
      if (stepsSize === 0) return;

      const result = new Array<number>(stepsSize);

      result[0] = ((steps[0] << 4) | stepsSize) & 0xff;
      for (let i = 0; i < stepsSize - 1; i += 2) {
        const index = 1 + i / 2;
        const firstStep = steps[i];
        const secondStep = steps.length > i + 1 ? steps[i + 1] : 0;
        result[index] = ((firstStep << 4) | secondStep) & 0xff;
      }

      return result;
    }

    const newDirs = SetStepData(dirs, dirs.length);
    if (!newDirs) return;

    packet.setDirections(newDirs, newDirs.length);

    this.sendToGS(packet.buffer);

    // console.log(
    //   `send walk path from [${x}, ${y}] steps: ${newDirs.join('->')}`
    // );
  }
})();
