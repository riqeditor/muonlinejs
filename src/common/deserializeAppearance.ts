import { ItemsDatabase } from './itemsDatabase';
import { CharacterClassNumber } from './types';
import { GetByteValue } from './utils';

type Item = {
  num: number;
  group: number;
  lvl: number;
};

export function deserializeAppearance(app: DataView) {
  const cls = ClassFromAppearance(GetByteValue(app.getUint8(0), 5, 3));

  const leftHandIndex = app.getUint8(1);
  const rightHandIndex = app.getUint8(2);

  const leftHandGroup = GetByteValue(app.getUint8(12), 3, 5);
  const rightHandGroup = GetByteValue(app.getUint8(13), 3, 5);

  console.log(`Left Hand: ${leftHandIndex}, Group: ${leftHandGroup}`);
  console.log(`Right Hand: ${rightHandIndex}, Group: ${rightHandGroup}`);

  const leftHand: Item | null =
    leftHandIndex === 0xff && leftHandGroup === 0x07
      ? null
      : { num: leftHandIndex, group: leftHandGroup, lvl: 0 };

  const rightHand: Item | null =
    rightHandIndex === 0xff && rightHandGroup === 0x07
      ? null
      : { num: rightHandIndex, group: rightHandGroup, lvl: 0 };

  // console.log(app);

  // const helmIndex =
  //   GetByteValue(app.getUint8(3), 4, 4) |
  //   (GetByteValue(app.getUint8(9), 1, 0) << 5) |
  //   (GetByteValue(app.getUint8(13), 4, 0) << 6);

  // const helmEmpty = ((helmIndex >> 6) & 0xf) === 0xf;

  const helmPiece = GetArmorPiece(app, 7, 3, true, 0x80, 13, false);
  const armorPiece = GetArmorPiece(app, 8, 3, false, 0x40, 14, true);
  const pantsPiece = GetArmorPiece(app, 9, 4, true, 0x20, 14, false);
  const glovesPiece = GetArmorPiece(app, 10, 4, false, 0x10, 15, true);
  const bootsPiece = GetArmorPiece(app, 11, 5, true, 0x08, 15, false);

  const helm: Item | null = helmPiece
    ? {
        ...helmPiece,
        lvl: 0,
      }
    : null;

  const armor: Item | null = armorPiece
    ? {
        ...armorPiece,
        lvl: 0,
      }
    : null;

  const pants: Item | null = pantsPiece
    ? {
        ...pantsPiece,
        lvl: 0,
      }
    : null;

  const gloves: Item | null = glovesPiece
    ? {
        ...glovesPiece,
        lvl: 0,
      }
    : null;

  // const bootsFirstIndex = GetByteValue(app.getUint8(5), 4, 4);
  // const bootsSecondIndex = GetByteValue(app.getUint8(9), 1, 4);
  // const bootsThirdIndex = GetByteValue(app.getUint8(15), 4, 4);

  // const bootsIndex =
  //   bootsFirstIndex | (bootsSecondIndex << 5) | (bootsThirdIndex << 6);
  // const bootsEmpty = (bootsThirdIndex & 0xf) === 0xf;

  const boots: Item | null = bootsPiece
    ? {
        ...bootsPiece,
        lvl: 0,
      }
    : null;

  // if (appearanceData.CharacterClass is not null)
  // {
  //     target[0] = (byte)(appearanceData.CharacterClass.Number << 3 & 0xF8);
  // }

  // target[0] |= (byte)appearanceData.Pose;

  // this.SetHand(target, itemArray[InventoryConstants.LeftHandSlot], 1, 12);

  // this.SetHand(target, itemArray[InventoryConstants.RightHandSlot], 2, 13);

  // this.SetArmorPiece(target, itemArray[InventoryConstants.HelmSlot], 3, true, 0x80, 13, false);

  // this.SetArmorPiece(target, itemArray[InventoryConstants.ArmorSlot], 3, false, 0x40, 14, true);

  // this.SetArmorPiece(target, itemArray[InventoryConstants.PantsSlot], 4, true, 0x20, 14, false);

  // this.SetArmorPiece(target, itemArray[InventoryConstants.GlovesSlot], 4, false, 0x10, 15, true);

  // this.SetArmorPiece(target, itemArray[InventoryConstants.BootsSlot], 5, true, 0x08, 15, false);

  // this.SetItemLevels(target, itemArray);

  // if (appearanceData.FullAncientSetEquipped)
  // {
  //     target[11] |= 0x01;
  // }

  // this.AddWing(target, itemArray[InventoryConstants.WingsSlot]);

  // this.AddPet(target, itemArray[InventoryConstants.PetSlot]);

  return {
    cls,
    leftHand,
    rightHand,
    helm,
    armor,
    pants,
    gloves,
    boots,
  } as const;
}

// thegame: o OpenMU grava `CharacterClass.Number << 3` no 1º byte da aparência
// (AppearanceSerializer.cs), então os 5 bits já são o CharacterClassNumber oficial.
// O mapeamento antigo trocava algumas classes (ex.: 2 virava GrandMaster em vez de
// SoulMaster) e não conhecia as classes de 3ª evolução.
function ClassFromAppearance(raw: number): CharacterClassNumber {
  return raw in CharacterClassNumber
    ? (raw as CharacterClassNumber)
    : CharacterClassNumber.DarkWizard;
}

// function SetHand(preview:DataView,  indexIndex:number,  groupIndex:number){

//   const index = preview.getUint8(indexIndex);
//   const group = preview.getUint8(groupIndex);
//         if (item?.Definition is null)
//         {
//             preview[indexIndex] = 0xFF;
//             preview[groupIndex] |= 0xF0;
//         }
//         else
//         {
//             preview[indexIndex] = (byte)item.Definition.Number;
//             preview[groupIndex] |= (byte)(item.Definition.Group << 5);
//         }
//     }

function GetOrMaskForHighNibble(value: number) {
  return (value << 4) & 0xf0;
}

function GetOrMaskForLowNibble(value: number) {
  return value & 0x0f;
}

function GetArmorPiece(
  app: DataView,
  group: number,
  firstIndex: number,
  firstIndexHigh: boolean,
  secondIndexMask: number,
  thirdIndex: number,
  thirdIndexHigh: boolean
) {
  const index =
    GetByteValue(app.getUint8(firstIndex), 4, firstIndexHigh ? 4 : 0) |
    (((app.getUint8(9) & secondIndexMask) === secondIndexMask ? 1 : 0) << 5) |
    (GetByteValue(app.getUint8(thirdIndex), 4, thirdIndexHigh ? 4 : 0) << 6);

  const isEmpty = ((index >> 6) & 0xf) === 0xf;

  if (isEmpty) return null;

  return {
    num: index,
    group,
  };

  // if (!item) {
  // SetEmptyArmor(preview, firstIndex, firstIndexHigh, secondIndexMask, thirdIndex, thirdIndexHigh);
  // } else {
  // item id
  // SetArmorItemIndex(preview, item, firstIndex, firstIndexHigh, secondIndexMask, thirdIndex, thirdIndexHigh);
  // exc bit
  // if (IsExcellent(item))
  // {
  //     preview[10] |= secondIndexMask;
  // }
  // ancient bit
  // if (IsAncient(item))
  // {
  //     preview[11] |= secondIndexMask;
  // }
  // }
}
