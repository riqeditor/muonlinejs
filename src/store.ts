import {
  CharacterClassNumber,
  ENUM_WORLD,
  SimpleModulusEncryptor,
  Xor32Encryptor,
  Xor3Byte,
} from './common';
import {
  ClientReadyAfterMapChangePacket,
  CreateCharacterPacket,
  HitRequestPacket,
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
import { encodeUtf8 } from './common/utf8';
import { findFreeInventorySlot, getEquipmentSlotFor } from './common/inventoryLayout';
import { ItemSerializer } from './common/itemSerializer';
import {
  CLIENT_VERSION,
  CS_HOST,
  CS_PORT,
  MAX_PASSWORD_LENGTH,
  MAX_USERNAME_LENGTH,
  MAX_WALK_STEPS,
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
import { ItemGroups, ServerPlayerActionType } from './common/objects/enum';
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

/** normal = jogador; whisper = sussurro recebido; whisper-sent = sussurro enviado; system = aviso. */
export type ChatEntryKind = 'normal' | 'whisper' | 'whisper-sent' | 'system';

export type ChatEntry = {
  id: number;
  kind: ChatEntryKind;
  sender?: string;
  text: string;
};

let areaSkillAnimationCounter = 0;

export type DamagePopup ={ id: number; netId: number; text: string; color: string };
const DAMAGE_POPUP_DURATION_MS = 1000;
let damagePopupCounter = 0;

const MAX_CHAT_MESSAGES = 50;
/** Limite de bytes da mensagem: o pacote C1 tem tamanho de 1 byte (até 255 no total). */
const MAX_CHAT_MESSAGE_BYTES = 100;
let chatMessageCounter = 0;

/**
 * Monta C1 00 PublicChatMessage ou C1 02 WhisperMessage:
 * [C1, tamanho, código, nome (10 bytes), mensagem UTF-8, 0].
 */
function buildChatPacket(code: 0x00 | 0x02, name: string, message: string): DataView {
  const nameBytes = encodeUtf8(name, 10);
  const messageBytes = encodeUtf8(message, MAX_CHAT_MESSAGE_BYTES);
  const length = 3 + 10 + messageBytes.length + 1;

  const bytes = new Uint8Array(length);
  bytes[0] = 0xc1;
  bytes[1] = length;
  bytes[2] = code;
  bytes.set(nameBytes, 3);
  bytes.set(messageBytes, 13);
  // O último byte já é 0 (fim do texto).

  return new DataView(bytes.buffer);
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

  /** Nome do personagem escolhido para entrar no jogo (usado no chat). */
  characterName = '';
  chatMessages: ChatEntry[] = [];
  chatOpen = false;
  chatInput = '';

  /** thegame: habilidades do personagem (C1 F3 11), na ordem do servidor. */
  skills: { index: number; number: number; level: number }[] = [];
  /** thegame: número da habilidade selecionada na barra (usada com o botão direito). */
  selectedSkill: number | null = null;

  /** thegame: slot do item "na mão" (selecionado para mover) no inventário. */
  heldItemSlot: number | null = null;
  /** thegame: o item "na mão" está sendo arrastado (botão do mouse ainda pressionado). */
  heldItemDragging = false;
  /** thegame: slot do item jogado no chão aguardando a resposta (C1 23). */
  pendingItemDrop: number | null = null;
  /** thegame: movimento de item aguardando a resposta do servidor (C3 24). */
  pendingItemMove: { fromSlot: number; toSlot: number } | null = null;

  /** thegame: menu do Esc (trocar de personagem / sair). */
  escMenuOpen = false;

  /** thegame: tela "Carregando mapa…" enquanto o mapa e as texturas carregam. */
  mapLoading = false;

  /** thegame: o jogador local morreu e espera o RespawnAfterDeath. */
  playerDead = false;
  /** thegame: números de dano flutuando sobre os personagens/monstros. */
  damagePopups: DamagePopup[] = [];

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
      characterName: observable,
      chatMessages: observable,
      chatOpen: observable,
      chatInput: observable,
      addChatMessage: action,
      sendChatMessage: action,
      playerDead: observable,
      mapLoading: observable,
      escMenuOpen: observable,
      heldItemSlot: observable,
      skills: observable,
      selectedSkill: observable,
      sendItemMove: action,
      equipItem: action,
      unequipItem: action,
      damagePopups: observable,
      addDamagePopup: action,
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
    this.characterName = name;
    this.sendToGS(selectCharacterPacket.buffer);
  }

  /**
   * C1 F3 12: avisa o servidor que o mapa terminou de carregar depois de um MapChanged.
   * Só então o OpenMU coloca o jogador de volta no mapa e envia monstros/NPCs/jogadores.
   */
  /** C1 11 HitRequest: ataque básico (sem habilidade) no objeto `targetId`. */
  sendHitRequest(targetId: number, direction: number): void {
    const packet = HitRequestPacket.createPacket();
    packet.TargetId = targetId;
    packet.AttackAnimation = ServerPlayerActionType.Attack1;
    packet.LookingDirection = direction;
    this.sendToGS(packet.buffer);
  }

  /**
   * C3 24 ItemMoveRequest dentro do inventário (slots 0–11 = equipamento, 12–75 = mochila).
   * O OpenMU só usa os slots (ItemMoveHandlerPlugIn); os 12 bytes do item vão por compatibilidade.
   */
  sendItemMove(fromSlot: number, toSlot: number): void {
    const item = this.playerData.items[fromSlot];
    if (!item || fromSlot === toSlot) return;

    const bytes = new Uint8Array(19);
    bytes[0] = 0xc3;
    bytes[1] = 19;
    bytes[2] = 0x24;
    bytes[3] = 0; // ItemStorageKind.Inventory
    bytes[4] = fromSlot;
    try {
      ItemSerializer.SerializeItem(bytes.subarray(5, 17), item);
    } catch {
      // Dados do item são ignorados pelo servidor; zeros servem.
    }
    bytes[17] = 0; // ItemStorageKind.Inventory
    bytes[18] = toSlot;

    this.pendingItemMove = { fromSlot, toSlot };
    this.sendToGS(new DataView(bytes.buffer));
  }

  /** Equipa o item da mochila no slot de equipamento certo (clique direito). */
  equipItem(fromSlot: number): void {
    const item = this.playerData.items[fromSlot];
    if (!item) return;
    const target = getEquipmentSlotFor(item, this.playerData.items);
    if (target === null) {
      this.addChatMessage('system', 'Este item não pode ser equipado.');
      return;
    }
    this.sendItemMove(fromSlot, target);
  }

  /** Desequipa para o primeiro espaço livre da mochila (clique direito no equipamento). */
  unequipItem(fromSlot: number): void {
    const item = this.playerData.items[fromSlot];
    if (!item) return;
    const target = findFreeInventorySlot(item, this.playerData.items, fromSlot);
    if (target === null) {
      this.addChatMessage('system', 'Não há espaço livre no inventário.');
      return;
    }
    this.sendItemMove(fromSlot, target);
  }

  /** C3 19 TargetedSkill: habilidade num alvo (ou em si mesmo, para buffs). */
  sendTargetedSkill(skillNumber: number, targetId: number): void {
    const bytes = new Uint8Array([
      0xc3, 7, 0x19,
      (skillNumber >> 8) & 0xff, skillNumber & 0xff,
      (targetId >> 8) & 0xff, targetId & 0xff,
    ]);
    this.sendToGS(new DataView(bytes.buffer));
  }

  /** C3 1E AreaSkill: habilidade de área no ponto (x, y). */
  sendAreaSkill(skillNumber: number, x: number, y: number, direction: number, extraTargetId = 0): void {
    areaSkillAnimationCounter = (areaSkillAnimationCounter + 1) & 0xff;
    const bytes = new Uint8Array([
      0xc3, 13, 0x1e,
      (skillNumber >> 8) & 0xff, skillNumber & 0xff,
      x & 0xff, y & 0xff,
      // Rotação em 256 passos (direção do MU 0..7 * 32).
      (direction * 32) & 0xff,
      0, 0,
      (extraTargetId >> 8) & 0xff, extraTargetId & 0xff,
      areaSkillAnimationCounter,
    ]);
    this.sendToGS(new DataView(bytes.buffer));
  }

  /** C3 F1 02 LogOut: 0 = fechar o jogo, 1 = voltar à seleção de personagem. */
  sendLogout(type: 0 | 1): void {
    const bytes = new Uint8Array([0xc3, 5, 0xf1, 0x02, type]);
    this.sendToGS(new DataView(bytes.buffer));
  }

  /** C3 23 DropItemRequest: joga o item do slot `slot` no chão em (x, y). */
  sendDropItem(slot: number, x: number, y: number): void {
    if (!this.playerData.items[slot]) return;
    this.pendingItemDrop = slot;
    const bytes = new Uint8Array([0xc3, 6, 0x23, x & 0xff, y & 0xff, slot]);
    this.sendToGS(new DataView(bytes.buffer));
  }

  /** C3 22 PickupItemRequest: pega o item/zen `itemId` do chão. */
  sendPickupItem(itemId: number): void {
    const bytes = new Uint8Array([0xc3, 5, 0x22, (itemId >> 8) & 0xff, itemId & 0xff]);
    this.sendToGS(new DataView(bytes.buffer));
  }

  addDamagePopup(netId: number, text: string, color: string): void {
    const popup: DamagePopup = { id: ++damagePopupCounter, netId, text, color };
    this.damagePopups.push(popup);
    setTimeout(
      action(() => {
        const index = this.damagePopups.findIndex(p => p.id === popup.id);
        if (index >= 0) this.damagePopups.splice(index, 1);
      }),
      DAMAGE_POPUP_DURATION_MS
    );
  }

  sendClientReadyAfterMapChange(): void {
    this.sendToGS(ClientReadyAfterMapChangePacket.createPacket().buffer);
  }

  addChatMessage(kind: ChatEntryKind, text: string, sender?: string): void {
    this.chatMessages.push({ id: ++chatMessageCounter, kind, text, sender });
    if (this.chatMessages.length > MAX_CHAT_MESSAGES) {
      this.chatMessages.splice(0, this.chatMessages.length - MAX_CHAT_MESSAGES);
    }
  }

  /**
   * Envia o texto digitado no chat.
   * - "/w Nome mensagem": sussurro (C1 02 WhisperMessage).
   * - qualquer outro texto, inclusive comandos "/..." do OpenMU: C1 00 PublicChatMessage.
   */
  sendChatMessage(rawText: string): void {
    const text = rawText.trim();
    if (!text) return;

    const whisper = /^\/w\s+(\S+)\s+([\s\S]+)$/i.exec(text);
    if (whisper) {
      const [, receiver, message] = whisper;
      this.sendToGS(buildChatPacket(0x02, receiver, message));
      this.addChatMessage('whisper-sent', message, receiver);
      return;
    }

    if (/^\/w(\s|$)/i.test(text)) {
      this.addChatMessage('system', 'Para sussurrar use: /w Nome mensagem');
      return;
    }

    // O servidor devolve a mensagem para todos por perto, inclusive quem enviou.
    this.sendToGS(buildChatPacket(0x00, this.characterName, text));
  }

  createCharacterRequest(name: string, charClass: CharacterClassNumber): void {
    const packet = CreateCharacterPacket.createPacket();
    packet.setName(name);
    packet.Class = charClass;

    this.sendToGS(packet.buffer);
  }

  /**
   * Envia o pedido de andar (C1 D4 WalkRequest) no formato que o OpenMU lê
   * (CharacterWalkBaseHandlerPlugIn.DecodePayload):
   * - byte 3/4: posição de origem;
   * - byte 5: quantidade de passos (4 bits baixos) e direção final (4 bits altos);
   * - a partir do byte 6: as direções, duas por byte (1ª nos 4 bits altos).
   * Cada direção é 0..7 (o servidor soma 1 para chegar no enum Direction).
   */
  sendWalkPath(x: number, y: number, dirs: number[]): void {
    const stepCount = Math.min(dirs.length, MAX_WALK_STEPS);
    if (stepCount === 0) return;

    const directionBytes = new Array<number>(Math.ceil(stepCount / 2)).fill(0);
    for (let i = 0; i < stepCount; i++) {
      const dir = dirs[i] & 0x0f;
      const index = i >> 1;
      directionBytes[index] |= i % 2 === 0 ? dir << 4 : dir;
    }

    const packet = WalkRequestPacket.createPacket(6 + directionBytes.length);
    packet.SourceX = x;
    packet.SourceY = y;
    packet.StepCount = stepCount;
    packet.TargetRotation = dirs[stepCount - 1] & 0x0f;
    packet.setDirections(directionBytes, directionBytes.length);

    this.sendToGS(packet.buffer);
  }
})();
