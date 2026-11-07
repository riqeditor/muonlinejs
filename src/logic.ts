import { runInAction } from 'mobx';
import { CharacterClassNumber, ENUM_WORLD } from './common';
import { deserializeAppearance } from './common/deserializeAppearance';
import { ItemsDatabase } from './common/itemsDatabase';
import { ItemSerializer } from './common/itemSerializer';
import { ModelFactoryPerId } from './common/modelFactoryPerId';
import { ModelObject } from './common/modelObject';
import { MonstersDatabase } from './common/monstersDatabase';
import {
  MonsterActionType,
  PlayerAction,
  ServerPlayerActionType,
} from './common/objects/enum';
import { HelloPacket } from './common/packets/ConnectServerPackets';
import {
  AddCharactersToScopePacket,
  AddNpcsToScopePacket,
  CharacterInformationPacket,
  CharacterInventoryPacket,
  ChatMessagePacket,
  CurrentHealthAndShieldPacket,
  CurrentManaAndAbilityPacket,
  GameServerEnteredPacket,
  ItemDropRemovedPacket,
  ItemsDroppedPacket,
  MapObjectOutOfScopePacket,
  ObjectAnimationPacket,
  ObjectGotKilledPacket,
  ObjectWalkedPacket,
  ServerMessagePacket,
} from './common/packets/ServerToClientPackets';
import { ServerToClientActionMap } from './common/playerActionMapper';
import { PlayerObject } from './common/playerObject';
import { Entity, World } from './ecs/world';
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

let serverListRequested = false;
EventBus.on('Hello', packet => {
  const p = new HelloPacket(packet);
  if (serverListRequested) return;
  serverListRequested = true;
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
    const definedModelFactory = ModelFactoryPerId[npc.TypeNumber];
    if (!definedModelFactory) {
      console.warn(
        `No model factory found for NPC type ${npc.TypeNumber}. Using default PlayerObject.`
      );
    }

    const modelFactory = definedModelFactory || PlayerObject;

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
      objectNameInWorld: MonstersDatabase.get(npc.TypeNumber)?.Name || 'NPC',
      interactable: true,
    });

    npcEntity.attributeSystem.setValue('isFemale', 0);
    npcEntity.attributeSystem.setValue('isFlying', 0);
  });
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

EventBus.on('ChatMessage', packet => {
  const p = new ChatMessagePacket(packet);
  console.log(
    `ChatMessage: ${p.Type}, sender:${p.Sender}, msg: ${p.Message}`,
    p
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

  if (obj.monsterAnimation) {
    obj.monsterAnimation.action = clientActionToPlay as any;
  } else if (obj.playerAnimation) {
    const action = ServerToClientActionMap[clientActionToPlay];
    if (action !== undefined) {
      obj.playerAnimation.action = action;
    }
  }

  obj.transform.rot.y = convertDirectionToAngle(p.Direction);
});

EventBus.on('ObjectGotKilled', packet => {
  const p = new ObjectGotKilledPacket(packet);

  const killedId = p.KilledId & 0x7fff;
  const obj = Store.world?.netObjsQuery.entities.find(
    e => e.netId === killedId
  );

  if (!obj) return;

  if (obj.localPlayer) {
  } else if (obj.monsterAnimation) {
    obj.monsterAnimation.action = MonsterActionType.Die;
  } else if (obj.playerAnimation) {
    obj.playerAnimation.action = PlayerAction.PLAYER_DIE1;
  }
});

EventBus.on('ItemsDropped', packet => {
  const world = Store.world;

  if (!world) return;

  const p = new ItemsDroppedPacket(packet);
  console.log(`ItemsDropped: ${p.ItemCount} items dropped`, p);

  p.getItems(p.ItemCount).forEach(item => {
    const maskedId = item.Id & 0x7fff;
    console.log(item);
    const data = item.ItemData;

    const id = data.getUint8(0); //[9]
    const group = data.getUint8(5) >> 4;

    const isMoney = data.byteLength >= 6 && id === 15 && group === 14; // Money is ItemGroup 14, ItemId 15

    const itemConfig = ItemsDatabase.getItem(group, id);

    console.log(itemConfig);

    let dropObj;

    if (isMoney) {
      const amount =
        (data.getUint8(1) << 16) | (data.getUint8(2) << 8) | data.getUint8(4);
      // const amount = data.byteLength >= 5 ? data.getUint8(4) : 0;

      // dropObj = new MoneyScopeObject(maskedId, rawId, x, y, amount);
      // _scopeManager.AddOrUpdateMoneyInScope(maskedId, rawId, x, y, amount);
      console.log(`Dropped Money: Amount=${amount}, ID=${maskedId}`);

      // Schedule on main thread for visual update and sound
      // MuGame.ScheduleOnMainThread(async () =>
      // {
      //     if (MuGame.Instance.ActiveScene?.World is not WalkableWorldControl w) return;
      //     // Remove existing visual object if it's already there (e.g., from a previous packet re-send)
      //     var existing = w.Objects.OfType<DroppedItemObject>().FirstOrDefault(d => d.NetworkId == maskedId);
      //     if (existing != null)
      //     {
      //         w.Objects.Remove(existing);
      //         existing.Dispose();
      //     }
      //     // Create and add the new visual object
      //     var obj = new DroppedItemObject(dropObj, _characterState.Id, _networkManager.GetCharacterService(), _loggerFactory.CreateLogger<DroppedItemObject>());
      //     w.Objects.Add(obj); // Add the object to the world's objects collection
      //     await obj.Load(); // Ensure its assets are loaded

      //     SoundController.Instance.PlayBufferWithAttenuation("Sound/pDropMoney.wav", obj.Position, w.Walker.Position); // Play money drop sound
      //     // Initial visibility check (hide if too far or out of view initially)
      //     obj.Hidden = !w.IsObjectInView(obj);
      //     _logger.LogDebug($"Spawned dropped money ({obj.DisplayName}) at {obj.Position.X},{obj.Position.Y},{obj.Position.Z}. RawId: {obj.RawId:X4}, MaskedId: {obj.NetworkId:X4}");
      // });
    } else {
      // dropObj = new ItemScopeObject(maskedId, rawId, x, y, data.ToArray());
      // _scopeManager.AddOrUpdateItemInScope(maskedId, rawId, x, y, data.ToArray());
      console.log(`Dropped Item: DataLen=${data.byteLength}, ID=${maskedId}`);

      // Schedule on main thread for visual update and sound
      // MuGame.ScheduleOnMainThread(async () =>
      // {
      //     if (MuGame.Instance.ActiveScene?.World is not WalkableWorldControl w) return;
      //     // Remove existing visual object if it's already there
      //     var existing = w.Objects.OfType<DroppedItemObject>().FirstOrDefault(d => d.NetworkId == maskedId);
      //     if (existing != null)
      //     {
      //         w.Objects.Remove(existing);
      //         existing.Dispose();
      //     }

      //     // Play drop sound based on item type (Jewel vs. Generic)
      //     byte[] dataCopy = item.ItemData.ToArray(); // Create a defensive copy
      //     string itemName = ItemDatabase.GetItemName(dataCopy) ?? string.Empty;

      //     var obj = new DroppedItemObject(dropObj, _characterState.Id, _networkManager.GetCharacterService(), _loggerFactory.CreateLogger<DroppedItemObject>());
      //     w.Objects.Add(obj); // Add the object to the world's objects collection
      //     await obj.Load(); // Ensure its assets are loaded

      //     if (itemName.StartsWith("Jewel", StringComparison.OrdinalIgnoreCase))
      //     {
      //         SoundController.Instance.PlayBufferWithAttenuation("Sound/pGem.wav", obj.Position, w.Walker.Position); // Play jewel drop sound
      //     }
      //     else
      //     {
      //         SoundController.Instance.PlayBufferWithAttenuation("Sound/pDropItem.wav", obj.Position, w.Walker.Position); // Play generic item drop sound
      //     }
      //     // Initial visibility check
      //     obj.Hidden = !w.IsObjectInView(obj);
      //     _logger.LogDebug($"Spawned dropped item ({obj.DisplayName}) at {obj.Position.X},{obj.Position.Y},{obj.Position.Z}. RawId: {obj.RawId:X4}, MaskedId: {obj.NetworkId:X4}");
      // });
    }

    world.add({
      netId: maskedId,
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
      modelFilePath: itemConfig.szModelFolder + itemConfig.szModelName,
    });
  });
});

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

  console.log(
    `%cServerMessage: ${p.Message}`,
    `color: ${color}; font-weight: bold; font-size: 1em;`
  ); // print message with color
});
