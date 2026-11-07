import { runInAction } from 'mobx';
import { CharacterClassNumber, ENUM_WORLD } from './common';
import { deserializeAppearance } from './common/deserializeAppearance';
import { decodeUtf8 } from './common/utf8';
import { experienceForLevel } from './common/experience';
import { SKILL_DEFINITIONS, SkillKind } from './common/skills/skillDefinitions';
import { directionTo } from './common/direction';
import { ItemsDatabase } from './common/itemsDatabase';
import { ItemSerializer } from './common/itemSerializer';
import { ModelFactoryPerId } from './common/modelFactoryPerId';
import {
  getGenericModelFactory,
  getMonsterModelName,
} from './common/monsters/genericMonster';
import { ModelObject } from './common/modelObject';
import { MonstersDatabase } from './common/monstersDatabase';
import {
  MonsterActionType,
  PlayerAction,
  ServerPlayerActionType,
} from './common/objects/enum';
import {
  AddCharactersToScopePacket,
  AddNpcsToScopePacket,
  CharacterInformationPacket,
  CharacterInventoryPacket,
  ChatMessageChatMessageTypeEnum,
  CurrentHealthAndShieldPacket,
  CurrentManaAndAbilityPacket,
  GameServerEnteredPacket,
  ItemDropRemovedPacket,
  ItemsDroppedPacket,
  MapChangedPacket,
  MapObjectOutOfScopePacket,
  ObjectMovedPacket,
  ObjectAnimationPacket,
  ObjectGotKilledPacket,
  ExperienceGainedPacket,
  CharacterLevelUpdatePacket,
  ObjectHitDamageKindEnum,
  ObjectHitPacket,
  ObjectWalkedPacket,
  ServerMessagePacket,
} from './common/packets/ServerToClientPackets';
import { ServerToClientActionMap } from './common/playerActionMapper';
import { PlayerObject } from './common/playerObject';
import { Entity, World, type Item } from './ecs/world';
import { createAttributeSystem } from './libs/attributeSystem';
import { Vector3 } from './libs/babylon/exports';
import { EventBus } from './libs/eventBus';
import { Store, UIState } from './store';

function convertDirectionToAngle(direction: number): number {
  // Convert the direction (0-7) to an angle in radians
  // 0 = 0 degrees, 1 = 45 degrees, ..., 7 = 315 degrees
  return (direction * Math.PI) / 4 - Math.PI / 4; // Convert to radians
}

export function spawnPlayer(
  world: World,
  { cls }: { cls?: CharacterClassNumber } = {}
) {
  const playerEntity = world.add({
    transform: {
      pos: new Vector3(),
      rot: Vector3.Zero(),
      scale: 1,
      posOffset: new Vector3(0.5, 0, 0.5),
    },
    modelFactory: PlayerObject,
    pathfinding: {
      from: { x: 0, y: 0 },
      to: { x: 0, y: 0 },
      path: [],
      calculated: true,
    },
    playerMoveTo: {
      point: { x: 0, y: 0 },
      handled: true as boolean,
    },
    movement: {
      velocity: { x: 0, y: 0 },
    },
    playerAnimation: {
      action: PlayerAction.PLAYER_SET,
    },
    attributeSystem: createAttributeSystem(),
    visibility: {
      state: 'hidden',
      lastChecked: 0,
    },
    screenPosition: {
      worldOffsetZ: 2.5,
      x: 0,
      y: 0,
    },
    objectNameInWorld: 'Player',
    charAppearance: {
      helm: null,
      armor: null,
      gloves: null,
      pants: null,
      boots: null,
      leftHand: null,
      rightHand: null,
      wings: null,
      charClass: cls ?? CharacterClassNumber.DarkKnight,
      changed: true,
    } satisfies NonNullable<Entity['charAppearance']> as NonNullable<
      Entity['charAppearance']
    >,
  });
  playerEntity.transform.pos.z = 1.7;

  playerEntity.attributeSystem.setValue('isFemale', 0);
  playerEntity.attributeSystem.setValue('isFlying', 0);
  playerEntity.attributeSystem.setValue('currentHealth', 0);
  playerEntity.attributeSystem.setValue('currentMana', 0);
  playerEntity.attributeSystem.setValue('maxHealth', 1);
  playerEntity.attributeSystem.setValue('maxMana', 1);
  playerEntity.attributeSystem.setValue('totalMovementSpeed', 3);
  playerEntity.attributeSystem.setValue(
    'playerNetClass',
    cls ?? CharacterClassNumber.DarkKnight
  );

  return playerEntity;
}

// thegame: pede a lista a cada conexão com o connect server. Antes havia uma trava
// "só na primeira vez" e, ao voltar para a tela de servidores sem recarregar a página,
// a lista nunca mais carregava.
EventBus.on('Hello', () => {
  Store.updateServerListRequest();
});

EventBus.on('GameServerEntered', bytes => {
  const p = new GameServerEnteredPacket(bytes);

  const id = p.PlayerId & 0x7fff;
  Store.playerId = id;
  console.log(`PlayerID: ${Store.playerId}`);

  Store.uiState = UIState.Login;
});

EventBus.on('CharacterInformation', packet => {
  const p = new CharacterInformationPacket(packet);

  const playerData = Store.playerData;

  runInAction(() => {
    playerData.money = p.Money;
    playerData.x = p.X;
    playerData.y = p.Y;

    playerData.exp = Number(p.CurrentExperience);
    playerData.expToNextLvl = Number(p.ExperienceForNextLevel);
    playerData.points = p.LevelUpPoints;

    // thegame: o CharacterInformation da Season 6 não traz o nível; vem da lista de personagens.
    const selected = Store.charactersList.find(c => c.Name === Store.characterName);
    if (selected) {
      playerData.level = selected.Level;
      playerData.currentLvlExp = experienceForLevel(selected.Level);
    }

    playerData.str = p.Strength;
    playerData.agi = p.Agility;
    playerData.sta = p.Vitality;
    playerData.eng = p.Energy;

    playerData.currentHP = p.CurrentHealth;
    playerData.maxHP = p.MaximumHealth;

    playerData.currentMP = p.CurrentMana;
    playerData.maxMP = p.MaximumMana;

    playerData.currentSD = p.CurrentShield;
    playerData.maxSD = p.MaximumShield;

    playerData.currentAG = p.CurrentAbility;
    playerData.maxAG = p.MaximumAbility;

    Store.uiState = UIState.World;

    EventBus.emit('requestWarp', { map: p.MapId, pos: { x: p.X, y: p.Y } });
  });
});

// EventBus.on('ServerMessage', packet => {
//   const p = new ServerMessagePacket(packet);
//   console.log(p);
// });

// EventBus.on('WeatherStatusUpdate', packet => {
//   const p = new WeatherStatusUpdatePacket(packet);
//   console.log(p);
// });
// EventBus.on('MessengerInitialization', packet => {
//   const p = new MessengerInitializationPacket(packet);
//   console.log(`MessengerInitialization, friends: ${p.FriendCount} letters: ${p.LetterCount}/${p.MaximumLetterCount}`);
// });

EventBus.on('CharacterInventory', packet => {
  const items = Store.playerData.items;
  const p = new CharacterInventoryPacket(packet);

  p.getItems(p.ItemCount).forEach(item => {
    const itemSlot = item.ItemSlot;
    const data = item.ItemData;

    const itemData = ItemSerializer.DeserializeItem(
      new Uint8Array(data.buffer)
    );

    items[itemSlot] = itemData;
  });

  Store.syncPlayerAppearance();
});

EventBus.on('CurrentHealthAndShield', packet => {
  const p = new CurrentHealthAndShieldPacket(packet);

  const playerEntity = Store.world?.playerEntity;
  if (!playerEntity) return;
  playerEntity.attributeSystem.setValue('currentHealth', p.Health);
  runInAction(() => {
    Store.playerData.currentHP = Math.floor(p.Health);
    Store.playerData.currentSD = Math.floor(p.Shield);
  });
});

EventBus.on('CurrentManaAndAbility', packet => {
  const p = new CurrentManaAndAbilityPacket(packet);

  const playerEntity = Store.world?.playerEntity;
  if (!playerEntity) return;

  playerEntity.attributeSystem.setValue('currentMana', p.Mana);
  runInAction(() => {
    Store.playerData.currentMP = Math.floor(p.Mana);
    Store.playerData.currentAG = Math.floor(p.Ability);
  });
});

EventBus.on('AddNpcsToScope', packet => {
  const p = new AddNpcsToScopePacket(packet);
  const npcs = p.getNPCs();
  console.log(p, npcs);

  const world = Store.world;
  if (!world) return;

  const worldIndex = world.mapIndex;

  npcs.forEach(npc => {
    const id = npc.Id & 0x7fff;
    // thegame: classe própria (ModelFactoryPerId) > modelo da tabela do MuMain > modelo padrão.
    const definedModelFactory =
      ModelFactoryPerId[npc.TypeNumber] ?? getGenericModelFactory(npc.TypeNumber);
    if (!definedModelFactory) {
      console.warn(
        `No model factory found for NPC type ${npc.TypeNumber}. Using default PlayerObject.`
      );
    }

    const modelFactory = definedModelFactory || PlayerObject;

    removeExistingNetObject(world, id);

    const npcEntity = world.add({
      netId: id,
      worldIndex,
      npcType: npc.TypeNumber,
      transform: {
        pos: new Vector3(
          npc.CurrentPositionX,
          world.getTerrainHeight(npc.CurrentPositionX, npc.CurrentPositionY),
          npc.CurrentPositionY
        ),
        rot: new Vector3(0, convertDirectionToAngle(npc.Rotation), 0),
        scale: modelFactory.OverrideScale >= 0 ? modelFactory.OverrideScale : 1,
      },
      modelFactory,
      pathfinding: {
        from: { x: 0, y: 0 },
        to: { x: 0, y: 0 },
        path: [],
        calculated: true,
      },
      playerMoveTo: {
        point: { x: 0, y: 0 },
        handled: true as boolean,
      },
      movement: {
        velocity: { x: 0, y: 0 },
      },
      monsterAnimation: {
        action: MonsterActionType.Stop1,
      },
      attributeSystem: createAttributeSystem(),
      visibility: {
        lastChecked: 0,
        state: 'hidden',
      },
      screenPosition: {
        worldOffsetZ: 2.5,
        x: 0,
        y: 0,
      },
      objectNameInWorld:
        MonstersDatabase.get(npc.TypeNumber)?.Name ||
        getMonsterModelName(npc.TypeNumber) ||
        'NPC',
      interactable: true,
    });

    npcEntity.attributeSystem.setValue('isFemale', 0);
    npcEntity.attributeSystem.setValue('isFlying', 0);
    // thegame: sem isso a velocidade ficava 0 e os monstros nunca andavam na tela,
    // mesmo recebendo ObjectWalked. O cliente não tem o MoveDelay de cada monstro;
    // a maioria no OpenMU usa 0,4 s por passo = 2,5 quadrados/s.
    npcEntity.attributeSystem.setValue('totalMovementSpeed', NPC_DEFAULT_MOVEMENT_SPEED);
  });
});

/** Quadrados por segundo (MoveDelay padrão de 0,4 s no OpenMU). */
const NPC_DEFAULT_MOVEMENT_SPEED = 2.5;

/**
 * thegame: se o servidor manda de novo um objeto que já está na tela (ele saiu e voltou
 * para o alcance, ou o pacote foi repetido), remove a cópia antiga para não duplicar.
 * O jogador local nunca é removido aqui.
 */
function removeExistingNetObject(world: World, netId: number) {
  for (const e of [...world.netObjsQuery.entities]) {
    if (e.netId === netId && !e.objOutOfScope && !e.localPlayer) {
      world.addComponent(e, 'objOutOfScope', true);
    }
  }
}

// thegame: os objetos que chegam enquanto o mapa ainda carrega recebem a altura do chão
// do mapa anterior (ex.: a tela de login) e ficavam embaixo do chão, invisíveis. Quando
// o mapa termina de carregar, recalcula a altura de todos os objetos desse mapa.
EventBus.on('warpCompleted', ({ map }) => {
  const world = Store.world;
  if (!world || !world.terrain) return;

  for (const e of world.netObjsQuery.entities) {
    if (e.worldIndex !== undefined && e.worldIndex !== map) continue;
    e.transform.pos.y = world.getTerrainHeight(e.transform.pos.x, e.transform.pos.z);
  }
});

EventBus.on('AddCharactersToScope', packet => {
  const p = new AddCharactersToScopePacket(packet);
  const chars = p.getCharacters();
  console.log(p, chars);

  const world = Store.world;
  if (!world) return;

  const worldIndex = world.mapIndex;

  chars.forEach(char => {
    const maskedId = char.Id & 0x7fff;

    // O próprio jogador já existe (ex.: o servidor o reenviou): só atualiza a posição.
    const localPlayer = world.playerEntity;
    if (localPlayer && localPlayer.netId === maskedId) {
      localPlayer.transform.pos.x = char.CurrentPositionX;
      localPlayer.transform.pos.z = char.CurrentPositionY;
      localPlayer.transform.pos.y = world.getTerrainHeight(
        char.CurrentPositionX,
        char.CurrentPositionY
      );
      return;
    }

    removeExistingNetObject(world, maskedId);

    const appearance = deserializeAppearance(char.Appearance);
    const playerEntity = spawnPlayer(world, { cls: appearance.cls });
    world.addComponent(playerEntity, 'netId', maskedId);
    world.addComponent(playerEntity, 'worldIndex', worldIndex);
    playerEntity.transform.pos.x = char.CurrentPositionX;
    playerEntity.transform.pos.z = char.CurrentPositionY;
    playerEntity.transform.pos.y = world.getTerrainHeight(
      char.CurrentPositionX,
      char.CurrentPositionY
    );

    playerEntity.transform.rot.y = convertDirectionToAngle(char.Rotation);

    playerEntity.objectNameInWorld = char.Name;

    if (Store.playerId === maskedId) {
      world.addComponent(playerEntity, 'localPlayer', true);
      console.log(`Local player spawned: ${maskedId} - ${char.Name}`);
    }

    const cApp = playerEntity.charAppearance;

    cApp.leftHand = appearance.leftHand;
    cApp.rightHand = appearance.rightHand;
    cApp.helm = appearance.helm;
    cApp.armor = appearance.armor;
    cApp.pants = appearance.pants;
    cApp.gloves = appearance.gloves;
    cApp.boots = appearance.boots;

    Object.values(cApp).forEach(item => {
      if (typeof item !== 'object' || item === null) return;

      const itemConfig = ItemsDatabase.getItem(item.group, item.num);
      console.log(`Item: ${itemConfig?.ItemName} (${item.group}, ${item.num})`);
    });

    cApp.changed = true;
  });
});

EventBus.on('MapObjectOutOfScope', packet => {
  const p = new MapObjectOutOfScopePacket(packet);
  p.getObjects(p.ObjectCount).forEach(obj => {
    const maskedId = obj.Id & 0x7fff;

    console.log(`Object out of scope: ${maskedId}`);
    const world = Store.world;
    if (!world) return;

    const objEntity = world.netObjsQuery.entities.find(
      e => e.netId === maskedId && !e.objOutOfScope
    );
    if (objEntity) {
      world.addComponent(objEntity, 'objOutOfScope', true);
    }
  });
});

// thegame: C3 1C 0F MapChanged. O servidor mudou o jogador de mapa ou o teleportou
// (ex.: comando "/move" de GM, portais). Antes ninguém tratava esse pacote e a tela
// ficava num lugar enquanto o servidor estava em outro.
EventBus.on('MapChanged', packet => {
  const p = new MapChangedPacket(packet);
  const world = Store.world;
  if (!world) return;

  const map = p.MapNumber as ENUM_WORLD;
  const pos = { x: p.PositionX, y: p.PositionY };
  console.log(`MapChanged: mapa ${map}, posição ${pos.x}, ${pos.y}`);

  const player = world.playerEntity;
  if (player) {
    player.pathfinding.path = [];
    player.pathfinding.calculated = true;
    player.playerMoveTo.handled = true;
    player.playerMoveTo.sendToServer = false;
    player.transform.rot.y = convertDirectionToAngle(p.Rotation);
  }

  if (map !== world.mapIndex) {
    // Outro mapa: carrega o mapa novo e, quando terminar, avisa o servidor (C1 F3 12),
    // que só então manda o que está em volta.
    pendingReadyAfterMapChange = map;
    EventBus.emit('requestWarp', { map, pos });
    return;
  }

  // Mesmo mapa: só move o jogador e avisa o servidor na hora.
  if (player) {
    player.transform.pos.x = pos.x;
    player.transform.pos.z = pos.y;
    player.transform.pos.y = world.getTerrainHeight(pos.x, pos.y);
  }
  Store.sendClientReadyAfterMapChange();
});

let pendingReadyAfterMapChange: ENUM_WORLD | null = null;
EventBus.on('warpCompleted', ({ map }) => {
  if (pendingReadyAfterMapChange !== map) return;
  pendingReadyAfterMapChange = null;
  Store.sendClientReadyAfterMapChange();
});

// thegame: C1 15 ObjectMoved. O servidor manda quando um objeto (inclusive o próprio
// jogador) muda de posição na hora: correção depois de um pedido de andar recusado,
// teleporte, etc. A posição do servidor manda: cancela o caminho e coloca o objeto lá.
EventBus.on('ObjectMoved', packet => {
  const p = new ObjectMovedPacket(packet);

  const world = Store.world;
  if (!world) return;

  const maskedId = p.ObjectId & 0x7fff;
  const obj = world.netObjsQuery.entities.find(e => e.netId === maskedId);
  if (!obj) return;

  const x = p.PositionX;
  const y = p.PositionY;

  if (obj.pathfinding) {
    obj.pathfinding.path = [];
    obj.pathfinding.calculated = true;
  }
  if (obj.playerMoveTo) {
    obj.playerMoveTo.handled = true;
    obj.playerMoveTo.sendToServer = false;
  }

  obj.transform.pos.x = x;
  obj.transform.pos.z = y;
  if (world.terrain) {
    obj.transform.pos.y = world.getTerrainHeight(x, y);
  }

  if (obj.localPlayer) {
    console.log(`Posição corrigida pelo servidor: ${x}, ${y}`);
  }
});

EventBus.on('ObjectWalked', packet => {
  const p = new ObjectWalkedPacket(packet);

  const world = Store.world;
  if (!world) return;

  const maskedId = p.ObjectId & 0x7fff;

  const obj = world.netObjsQuery.entities.find(e => e.netId === maskedId);
  if (!obj) return;

  if (obj.localPlayer) return;

  if (obj.playerMoveTo) {
    obj.playerMoveTo.handled = false;
    obj.playerMoveTo.point.x = p.TargetX;
    obj.playerMoveTo.point.y = p.TargetY;
  } else {
    obj.transform.pos.x = p.TargetX;
    obj.transform.pos.z = p.TargetY;
  }

  obj.transform.rot.y = convertDirectionToAngle(p.TargetRotation);

  const dirs = new Array(p.StepCount).fill(0);
  for (let i = 0; i < p.StepCount; i++) {
    dirs[i] = p.StepData.getUint8(i);
  }

  // C1 09 D4 02 04 B1 7E 60 00

  console.log(
    `ObjectWalked: ${maskedId}, steps: ${p.StepCount}, directions: ${dirs.join(
      '->'
    )}, x: ${p.TargetX}, y: ${p.TargetY}, rotation: ${p.TargetRotation}`,
    packet
  );
});

// thegame: C1 00 (normal) / C1 02 (sussurro) ChatMessage. Texto em UTF-8, como o OpenMU envia.
EventBus.on('ChatMessage', packet => {
  const type = packet.getUint8(2);
  const sender = decodeUtf8(packet, 3, 13);
  const message = decodeUtf8(packet, 13);

  console.log(`ChatMessage: ${type}, sender:${sender}, msg: ${message}`);

  runInAction(() =>
    Store.addChatMessage(
      type === ChatMessageChatMessageTypeEnum.Whisper ? 'whisper' : 'normal',
      message,
      sender
    )
  );
});

EventBus.on('ObjectAnimation', packet => {
  const p = new ObjectAnimationPacket(packet);

  const maskedId = p.ObjectId & 0x7fff;
  const obj = Store.world?.netObjsQuery.entities.find(
    e => e.netId === maskedId
  );

  if (!obj) return;

  let serverActionId = p.Animation as ServerPlayerActionType;
  let clientActionToPlay = serverActionId;
  if (obj.monsterAnimation) {
    clientActionToPlay = ((serverActionId & 0xe0) >> 5) & 0xff;
  }

  console.log(
    `ObjectAnimation: ${maskedId}, action: ${clientActionToPlay}, target: ${p.TargetId}, dir:${p.Direction}`,
    packet
  );

  if (obj.dead) return;

  // thegame: ataques/gestos duram um tempo e depois voltam ao normal (antes ficavam presos).
  const lockedUntil = gameTimeNow() + ACTION_ANIMATION_TIME;
  if (obj.monsterAnimation) {
    obj.monsterAnimation.action = clientActionToPlay as any;
    obj.monsterAnimation.lockedUntil = lockedUntil;
  } else if (obj.playerAnimation) {
    const action = ServerToClientActionMap[clientActionToPlay];
    if (action !== undefined) {
      obj.playerAnimation.action = action;
      obj.playerAnimation.lockedUntil = lockedUntil;
    }
  }

  obj.transform.rot.y = convertDirectionToAngle(p.Direction);
});

/** Tempo até o corpo do monstro sumir (ms). */
const CORPSE_REMOVE_DELAY_MS = 1800;

/** Duração (s) de animações de ataque/golpe vindas do servidor. */
const ACTION_ANIMATION_TIME = 0.6;
const SHOCK_ANIMATION_TIME = 0.35;

function gameTimeNow(): number {
  return Store.world?.gameTime.TotalGameTime.TotalSeconds ?? 0;
}

function findNetObject(netId: number) {
  return Store.world?.netObjsQuery.entities.find(e => e.netId === netId && !e.objOutOfScope);
}

const DAMAGE_COLORS: Record<number, string> = {
  [ObjectHitDamageKindEnum.NormalRed]: '#ff4a3d',
  [ObjectHitDamageKindEnum.IgnoreDefenseCyan]: '#3de8ff',
  [ObjectHitDamageKindEnum.ExcellentLightGreen]: '#7dff6b',
  [ObjectHitDamageKindEnum.CriticalBlue]: '#4d8dff',
  [ObjectHitDamageKindEnum.LightPink]: '#ff9ad5',
  [ObjectHitDamageKindEnum.PoisonDarkGreen]: '#2fa84f',
  [ObjectHitDamageKindEnum.ReflectedDarkPink]: '#d1458f',
  [ObjectHitDamageKindEnum.White]: '#ffffff',
};

// thegame: C1 11 ObjectHit. Alguém (o jogador local, outro jogador ou um monstro) levou dano:
// mostra o número sobre ele e toca a animação de golpe. A vida do jogador local é
// atualizada pelo C1 26 FF (CurrentHealthAndShield).
EventBus.on('ObjectHit', packet => {
  const p = new ObjectHitPacket(packet);
  const id = p.ObjectId & 0x7fff;
  const total = p.HealthDamage + p.ShieldDamage;

  const multiplier = p.IsTripleDamage ? ' x3' : p.IsDoubleDamage ? ' x2' : '';
  const text = total > 0 ? `${total}${multiplier}` : 'MISS';
  const color = total > 0 ? DAMAGE_COLORS[p.Kind] ?? '#ff4a3d' : '#d0d0d0';
  runInAction(() => Store.addDamagePopup(id, text, color));

  const obj = findNetObject(id);
  if (!obj || obj.dead || total <= 0) return;

  const lockedUntil = gameTimeNow() + SHOCK_ANIMATION_TIME;
  if (obj.monsterAnimation) {
    obj.monsterAnimation.action = MonsterActionType.Shock;
    obj.monsterAnimation.lockedUntil = lockedUntil;
  } else if (obj.playerAnimation && obj.playerAnimation.lockedUntil === undefined) {
    obj.playerAnimation.action = PlayerAction.PLAYER_SHOCK;
    obj.playerAnimation.lockedUntil = lockedUntil;
  }
});

EventBus.on('ObjectGotKilled', packet => {
  const p = new ObjectGotKilledPacket(packet);
  const world = Store.world;
  if (!world) return;

  const killedId = p.KilledId & 0x7fff;
  const obj = findNetObject(killedId);
  if (!obj) return;

  world.addComponent(obj, 'dead', true);
  if (world.attackTargetNetId === killedId) {
    world.attackTargetNetId = null;
  }

  // Para de andar.
  if (obj.pathfinding) {
    obj.pathfinding.path = [];
    obj.pathfinding.calculated = true;
  }
  if (obj.playerMoveTo) {
    obj.playerMoveTo.handled = true;
    obj.playerMoveTo.sendToServer = false;
  }

  if (obj.monsterAnimation) {
    obj.monsterAnimation.action = MonsterActionType.Die;
  } else if (obj.playerAnimation) {
    obj.playerAnimation.action = PlayerAction.PLAYER_DIE1;
  }

  // thegame: monstro morto some depois da animação de queda. Antes o corpo ficava
  // parado no lugar (e voltava a ficar de pé). O OpenMU reenvia o monstro quando
  // ele renasce (AddNpcsToScope), como um objeto novo.
  if (obj.npcType !== undefined) {
    setTimeout(() => {
      if (obj.dead && !obj.objOutOfScope && Store.world?.has(obj)) {
        Store.world.addComponent(obj, 'objOutOfScope', true);
      }
    }, CORPSE_REMOVE_DELAY_MS);
  }

  if (obj.localPlayer) {
    world.attackTargetNetId = null;
    runInAction(() => {
      Store.playerDead = true;
      Store.playerData.currentHP = 0;
    });
  }
});

// thegame: C3 16 ExperienceGained. XP ganha ao matar um monstro.
EventBus.on('ExperienceGained', packet => {
  const p = new ExperienceGainedPacket(packet);
  const added = p.AddedExperience;
  if (added <= 0) return;

  runInAction(() => {
    Store.playerData.exp += added;
    const localId = Store.world?.playerEntity?.netId;
    if (localId !== undefined) {
      Store.addDamagePopup(localId, `+${added} XP`, '#ffd75e');
    }
  });
});

// thegame: C1 F3 05 CharacterLevelUpdate. Subiu de nível: atualiza nível, pontos e máximos,
// e calcula a faixa de XP do novo nível (o pacote não traz a XP do próximo nível).
EventBus.on('CharacterLevelUpdate', packet => {
  const p = new CharacterLevelUpdatePacket(packet);
  const playerData = Store.playerData;

  runInAction(() => {
    playerData.level = p.Level;
    playerData.points = p.LevelUpPoints;
    playerData.maxHP = p.MaximumHealth;
    playerData.maxMP = p.MaximumMana;
    playerData.maxSD = p.MaximumShield;
    playerData.maxAG = p.MaximumAbility;
    playerData.currentLvlExp = experienceForLevel(p.Level);
    playerData.expToNextLvl = experienceForLevel(p.Level + 1);

    Store.addChatMessage(
      'system',
      `Parabéns! Você subiu para o nível ${p.Level}. Pontos para distribuir: ${p.LevelUpPoints}.`
    );
    const localId = Store.world?.playerEntity?.netId;
    if (localId !== undefined) {
      Store.addDamagePopup(localId, `NÍVEL ${p.Level}!`, '#ffe14d');
    }
  });

  const player = Store.world?.playerEntity;
  if (player) {
    player.attributeSystem.setValue('maxHealth', p.MaximumHealth);
    player.attributeSystem.setValue('maxMana', p.MaximumMana);
  }
});

// thegame: C1 F3 04 RespawnAfterDeath (Season 6). O cliente só tem as definições das
// versões 0.75/0.95 (mesmo código), então o pacote chega com esses nomes; aqui os
// bytes são lidos no formato Season 6 (OpenMU/docs/Packets/C1-F3-04-RespawnAfterDeath_by-server.md).
function onRespawnAfterDeath(packet: DataView) {
  const world = Store.world;
  const player = world?.playerEntity;
  if (!world || !player || packet.byteLength < 28) return;

  const x = packet.getUint8(4);
  const y = packet.getUint8(5);
  const map = packet.getUint8(6) as ENUM_WORLD;
  const direction = packet.getUint8(7);
  const health = packet.getUint16(8, true);
  const mana = packet.getUint16(10, true);
  const shield = packet.getUint16(12, true);
  const ability = packet.getUint16(14, true);
  const money = packet.getUint32(24, true);

  console.log(`Renascendo no mapa ${map} em ${x}, ${y}`);

  world.removeComponent(player, 'dead');
  player.playerAnimation.action = PlayerAction.PLAYER_STOP_MALE;
  player.playerAnimation.lockedUntil = undefined;
  player.pathfinding.path = [];
  player.pathfinding.calculated = true;
  player.playerMoveTo.handled = true;
  player.playerMoveTo.sendToServer = false;
  player.transform.rot.y = convertDirectionToAngle(direction);
  player.attributeSystem.setValue('currentHealth', health);
  player.attributeSystem.setValue('currentMana', mana);

  runInAction(() => {
    Store.playerDead = false;
    Store.playerData.currentHP = health;
    Store.playerData.currentMP = mana;
    Store.playerData.currentSD = shield;
    Store.playerData.currentAG = ability;
    Store.playerData.money = money;
  });

  if (map !== world.mapIndex) {
    EventBus.emit('requestWarp', { map, pos: { x, y } });
    return;
  }

  player.transform.pos.x = x;
  player.transform.pos.z = y;
  player.transform.pos.y = world.getTerrainHeight(x, y);
}
EventBus.on('RespawnAfterDeath075', onRespawnAfterDeath);
EventBus.on('RespawnAfterDeath095', onRespawnAfterDeath);

// thegame: C2 20 ItemsDropped. Itens/zen caídos no chão: cria o objeto com o modelo
// (quando existe), o nome visível e a marca `groundItem` para poder ser pego.
EventBus.on('ItemsDropped', packet => {
  const world = Store.world;
  if (!world) return;

  const p = new ItemsDroppedPacket(packet);

  p.getItems(p.ItemCount).forEach(item => {
    const maskedId = item.Id & 0x7fff;
    const data = item.ItemData;
    if (data.byteLength < 6) return;

    const id = data.getUint8(0);
    const group = data.getUint8(5) >> 4;
    const level = (data.getUint8(1) >> 3) & 0x0f;
    const isMoney = id === 15 && group === 14; // Zen = grupo 14, item 15

    const itemConfig = ItemsDatabase.getItem(group, id);

    let name: string;
    if (isMoney) {
      const amount = (data.getUint8(1) << 16) | (data.getUint8(2) << 8) | data.getUint8(4);
      name = `${amount.toLocaleString('pt-BR')} Zen`;
    } else {
      name = `${itemConfig?.ItemName ?? `Item ${group}/${id}`}${level > 0 ? ` +${level}` : ''}`;
    }

    removeExistingNetObject(world, maskedId);

    world.add({
      netId: maskedId,
      worldIndex: world.mapIndex,
      groundItem: { isMoney },
      objectNameInWorld: name,
      screenPosition: { worldOffsetZ: 0.6, x: 0, y: 0 },
      transform: {
        pos: new Vector3(
          item.PositionX,
          world.getTerrainHeight(item.PositionX, item.PositionY) + 0.1,
          item.PositionY
        ),
        rot: Vector3.Zero(),
        scale: 1,
      },
      modelFactory: ModelObject,
      ...(itemConfig
        ? { modelFilePath: itemConfig.szModelFolder + itemConfig.szModelName }
        : {}),
    });
  });
});

// thegame: respostas do C3 22 (pegar item). O OpenMU usa o mesmo código para três
// mensagens e o cliente lê todas como ItemAddedToInventory; aqui elas são separadas:
// - 8 bytes com FE no byte 3: InventoryMoneyUpdate (zen atual, big endian);
// - 4 bytes: ItemPickUpRequestFailed (motivo no byte 3; 253 = empilhou, não é erro);
// - o resto: ItemAddedToInventory (slot no byte 3, dados do item a partir do byte 4).
function onPickupResponse(packet: DataView) {
  const playerData = Store.playerData;
  const localId = Store.world?.playerEntity?.netId;

  if (packet.byteLength === 8 && packet.getUint8(3) === 0xfe) {
    const money = packet.getUint32(4, false);
    const gained = money - playerData.money;
    runInAction(() => {
      playerData.money = money;
      if (gained > 0 && localId !== undefined) {
        Store.addDamagePopup(localId, `+${gained.toLocaleString('pt-BR')} Zen`, '#ffd75e');
      }
    });
    return;
  }

  if (packet.byteLength <= 4) {
    const reason = packet.byteLength === 4 ? packet.getUint8(3) : 255;
    if (reason !== 253) {
      runInAction(() =>
        Store.addChatMessage('system', 'Não foi possível pegar o item (inventário cheio?).')
      );
    }
    return;
  }

  const slot = packet.getUint8(3);
  const itemBytes = new Uint8Array(packet.buffer, packet.byteOffset + 4, packet.byteLength - 4);
  let parsed: Item;
  try {
    parsed = ItemSerializer.DeserializeItem(itemBytes);
  } catch (error) {
    console.error('Item recebido não pôde ser lido', error);
    return;
  }

  const name = ItemsDatabase.getItem(parsed.group, parsed.num)?.ItemName ?? 'Item';
  runInAction(() => {
    playerData.items[slot] = parsed;
    Store.addChatMessage('system', `Você pegou: ${name}${parsed.lvl ? ` +${parsed.lvl}` : ''}`);
  });
  Store.syncPlayerAppearance();
}
// thegame: C3 24 ItemMoved / C3 24 FF ItemMoveRequestFailed — resposta ao mover/equipar.
// O ItemMoved não diz de onde o item saiu; o cliente guarda o pedido em Store.pendingItemMove.
function onItemMoveResponse(packet: DataView) {
  const pending = Store.pendingItemMove;
  Store.pendingItemMove = null;
  console.log(
    `ItemMove resposta (${packet.byteLength} bytes): ` +
      Array.from(new Uint8Array(packet.buffer, packet.byteOffset, packet.byteLength))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' '),
    pending
  );

  if (packet.byteLength < 5 || packet.getUint8(3) === 0xff) {
    runInAction(() => Store.addChatMessage('system', 'Não foi possível mover o item.'));
    return;
  }

  const storage = packet.getUint8(3);
  const targetSlot = packet.getUint8(4);
  if (storage !== 0) return; // só o inventário por enquanto

  let parsed: Item;
  try {
    parsed = ItemSerializer.DeserializeItem(
      new Uint8Array(packet.buffer, packet.byteOffset + 5, packet.byteLength - 5)
    );
  } catch (error) {
    console.error('Item movido não pôde ser lido', error);
    return;
  }

  runInAction(() => {
    const items = Store.playerData.items;
    if (pending && pending.fromSlot !== targetSlot) {
      items[pending.fromSlot] = null as unknown as Item;
    }
    items[targetSlot] = parsed;
  });
  Store.syncPlayerAppearance();
}
// thegame: C1 F3 11 lista de habilidades (SkillListUpdate / SkillAdded / SkillRemoved, mesmo
// código). Byte 4 = quantidade (lista) ou 0xFE (adiciona uma) ou 0xFF (remove uma);
// byte 5 = tipo da lista; a partir do byte 6, entradas de 4 bytes [índice, número LE16, nível].
function onSkillList(packet: DataView) {
  if (packet.byteLength < 6) return;
  const flag = packet.getUint8(4);
  const listType = packet.getUint8(5);

  const readEntry = (offset: number) => ({
    index: packet.getUint8(offset),
    number: packet.getUint16(offset + 1, true),
    level: packet.getUint8(offset + 3),
  });

  runInAction(() => {
    if (flag === 0xfe || flag === 0xff) {
      if (packet.byteLength < 10) return;
      const entry = readEntry(6);
      Store.skills = Store.skills.filter(s => s.number !== entry.number);
      if (flag === 0xfe) {
        Store.skills.push(entry);
        Store.skills.sort((a, b) => a.index - b.index);
      } else if (Store.selectedSkill === entry.number) {
        Store.selectedSkill = null;
      }
      return;
    }

    const entries = [];
    for (let i = 0; i < flag && 6 + i * 4 + 4 <= packet.byteLength; i++) {
      entries.push(readEntry(6 + i * 4));
    }
    if (listType === 0) {
      Store.skills = entries;
    } else if (listType === 2) {
      const removed = new Set(entries.map(e => e.number));
      Store.skills = Store.skills.filter(s => !removed.has(s.number));
    } else {
      const added = new Set(entries.map(e => e.number));
      Store.skills = [...Store.skills.filter(s => !added.has(s.number)), ...entries];
    }

    const usable = Store.skills.filter(s => isUsableSkill(s.number));
    if (Store.selectedSkill === null || !usable.some(s => s.number === Store.selectedSkill)) {
      Store.selectedSkill = usable[0]?.number ?? null;
    }
  });
}
EventBus.on('SkillAdded', onSkillList);
EventBus.on('SkillRemoved', onSkillList);
EventBus.on('SkillListUpdate', onSkillList);

/** Habilidades que o jogador usa (não passivas). */
export function isUsableSkill(number: number): boolean {
  const def = SKILL_DEFINITIONS[number];
  return !!def && def[1] !== SkillKind.PassiveBoost;
}

// thegame: C3 19 SkillAnimation — alguém usou uma habilidade: anima o lançador.
EventBus.on('SkillAnimation', packet => {
  if (packet.byteLength < 9) return;
  const casterId = packet.getUint16(5, false) & 0x7fff;
  const targetId = packet.getUint16(7, false) & 0x7fff;
  const caster = findNetObject(casterId);
  if (!caster || caster.dead || caster.localPlayer) return;

  const target = findNetObject(targetId);
  if (target && target !== caster) {
    const dir = directionTo(
      caster.transform.pos.x,
      caster.transform.pos.z,
      target.transform.pos.x,
      target.transform.pos.z
    );
    caster.transform.rot.y = convertDirectionToAngle(dir);
  }

  const lockedUntil = gameTimeNow() + ACTION_ANIMATION_TIME;
  if (caster.playerAnimation) {
    caster.playerAnimation.action = PlayerAction.PLAYER_ATTACK_FIST;
    caster.playerAnimation.lockedUntil = lockedUntil;
  } else if (caster.monsterAnimation) {
    caster.monsterAnimation.action = MonsterActionType.Attack1;
    caster.monsterAnimation.lockedUntil = lockedUntil;
  }
});

EventBus.on('ItemMoved', onItemMoveResponse);
EventBus.on('ItemMoveRequestFailed', onItemMoveResponse);

EventBus.on('ItemAddedToInventory', onPickupResponse);
EventBus.on('ItemPickUpRequestFailed', onPickupResponse);
EventBus.on('InventoryMoneyUpdate', onPickupResponse);

EventBus.on('ItemDropRemoved', packet => {
  const world = Store.world;
  if (!world) return;

  const p = new ItemDropRemovedPacket(packet);
  p.getItemData(p.ItemCount).forEach(item => {
    const maskedId = item.Id & 0x7fff;
    const itemEntity = world.netObjsQuery.entities.find(
      e => e.netId === maskedId
    );
    if (itemEntity) {
      world.addComponent(itemEntity, 'objOutOfScope', true);
      console.log(`Removed item entity with netId: ${maskedId}`);
    } else {
      console.warn(`Item entity with netId ${maskedId} not found.`);
    }
  });
});

EventBus.on('ServerMessage', packet => {
  const p = new ServerMessagePacket(packet);
  console.log(p);

  let color = '#fff';

  switch (p.Type) {
    case 0: // golden center text
      color = '#ffd700';
      break;
    case 1: //blue normal text
      color = '#0000ff';
      break;
    case 2: //guild notice
      color = '#00ff00';
      break;
  }

  // thegame: mensagem do servidor (C1 0D) vai para a caixa de chat como aviso.
  // O OpenMU prefixa o texto com "000000000" (campos numéricos do formato do cliente
  // original, que ele mostra sem esses dígitos).
  const message = decodeUtf8(packet, 4).replace(/^0{9}/, '');
  console.log(
    `%cServerMessage: ${message}`,
    `color: ${color}; font-weight: bold; font-size: 1em;`
  ); // print message with color

  if (message) {
    runInAction(() => Store.addChatMessage('system', message));
  }
});
