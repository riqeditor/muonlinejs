import { Item } from '../ecs/world';
import { castToByte } from './utils';

const LuckFlag = 4;
const SkillFlag = 128;
const LevelMask = 0x78;
const GuardianOptionFlag = 0x08;
const AncientBonusLevelMask = 0b1100;
const AncientDiscriminatorMask = 0b0011;
const AncientMask = AncientBonusLevelMask | AncientDiscriminatorMask;

function IsTrainablePet(item: Item) {
  return false; //item.itemDefinition.PetExperienceFormula !== null;
}
/// <summary>
/// This item serializer is used to serialize the item data to the data packets.
/// At the moment, each item is serialized into a 12-byte long part of an array:
/// Byte Order: ItemCode Options Dura Exe Ancient Kind/380Opt HarmonyOpt Socket1 Socket2 Socket3 Socket4 Socket5.
/// </summary>
export class ItemSerializer {
  static readonly NeededSpace = 12;

  static SerializeItem(target: Uint8Array, item: Item): number {
    target[0] = item.num;

    const itemLevel = IsTrainablePet(item) ? 0 : item.lvl ?? 0; // itemDefinition.PetExperienceFormula is not null;
    target[1] = castToByte((itemLevel << 3) & LevelMask);

    // var itemOption = item.ItemOptions.FirstOrDefault(o => o.ItemOption?.OptionType == ItemOptionTypes.Option);
    // if (itemOption != null)
    // {
    //     var optionLevel = itemOption.Level;

    //     // A dinorant can normally have up to 2 options, all being coded in the item option level.
    //     // A one-option dino has level = 1, 2, or 4; a two-option has level = 3, 5, or 6.
    //     if (item.Definition.Skill?.Number == 49)
    //     {
    //         item.ItemOptions.Where(o => o.ItemOption?.OptionType == ItemOptionTypes.Option && o != itemOption)
    //             .ForEach(o => optionLevel |= o.Level);
    //     }

    //     // The item option level is splitted into 2 parts. Webzen... :-/
    //     target[1] += castToByte(optionLevel & 3); // setting the first 2 bits
    //     target[3] = castToByte((optionLevel & 4) << 4); // The highest bit is placed into the 2nd bit of the exc byte (0x40).

    //     // Some items (wings) can have different options (3rd wings up to 3!)
    //     // Alternate options are set at array[startIndex + 3] |= 0x20 and 0x10
    //     if (itemOption.ItemOption?.Number > 0)
    //     {
    //         target[3] |= castToByte((itemOption.ItemOption.Number & 0b11) << 4);
    //     }
    // }

    // target[2] = item.Durability();

    // target[3] |= GetExcellentByte(item);

    if ((item.num & 0x100) === 0x100) {
      // Support for 512 items per Group
      target[3] |= 0x80;
    }

    // target[3] |= GetFenrirByte(item);

    // if (item.ItemOptions.Any(o => o.ItemOption?.OptionType == ItemOptionTypes.Luck))
    // {
    //     target[1] |= LuckFlag;
    // }

    // if (item.HasSkill)
    // {
    //     target[1] |= SkillFlag;
    // }

    // var ancientSet = item.ItemSetGroups.FirstOrDefault(set => set.AncientSetDiscriminator != 0);
    // if (ancientSet != null)
    // {
    //     target[4] |= (byte)(ancientSet.AncientSetDiscriminator & AncientDiscriminatorMask);

    //     // An ancient item may or may not have an ancient bonus option. Example without bonus: Gywen Pendant.
    //     var ancientBonus = item.ItemOptions.FirstOrDefault(o => o.ItemOption?.OptionType == ItemOptionTypes.AncientBonus);
    //     if (ancientBonus != null)
    //     {
    //         target[4] |= (byte)((ancientBonus.Level << 2) & AncientBonusLevelMask);
    //     }
    // }

    target[5] = castToByte(item.group << 4);
    // if (item.ItemOptions.Any(o => o.ItemOption?.OptionType == ItemOptionTypes.GuardianOption))
    // {
    //     target[5] |= GuardianOptionFlag;
    // }

    // target[6] = (byte)(GetHarmonyByte(item) | GetSocketBonusByte(item));
    // SetSocketBytes(target.Slice(7, MaximumSockets), item);

    return ItemSerializer.NeededSpace;
  }

  /// <inheritdoc />
  static DeserializeItem(array: Uint8Array): Item {
    const itemNumber = array[0] + ((array[0] & 0x80) << 1);
    const itemGroup = (array[5] & 0xf0) >> 4;
    // var definition = gameConfiguration.Items.FirstOrDefault(def => def.Number == itemNumber && def.Group == itemGroup)
    //                  ?? throw new ArgumentException($"Couldn't find the item definition for the given byte array. Extracted item number and group: {itemNumber}, {itemGroup}");

    // var item = persistenceContext.CreateNew<Item>();
    // item.Definition = definition;

    const item: Item = {
      group: itemGroup,
      num: itemNumber,
    };

    item.lvl = castToByte((array[1] & LevelMask) >> 3);

    // thegame: as opções seguem o mesmo formato do OpenMU (GameServer/RemoteView/ItemSerializer.cs).
    item.durability = array[2];
    item.hasSkill = (array[1] & SkillFlag) !== 0;
    item.hasLuck = (array[1] & LuckFlag) !== 0;
    item.optionLevel = (array[1] & 3) + ((array[3] >> 4) & 4);
    item.excellentBits = array[3] & 0x3f;
    item.isExcellent = item.excellentBits !== 0;
    item.isAncient = (array[4] & 0x0f) !== 0;

    // if (item.Definition.PossibleItemOptions.Any(o =>
    //         o.PossibleOptions.Any(i => i.OptionType == ItemOptionTypes.Excellent)))
    // {
    //     ReadExcellentOption(array[3], persistenceContext, item);
    // }
    // else if (item.Definition.PossibleItemOptions.Any(o =>
    //              o.PossibleOptions.Any(i => i.OptionType == ItemOptionTypes.Wing)))
    // {
    //     ReadWingOption(array[3], persistenceContext, item);
    // }
    // else
    // {
    //     // set nothing.
    // }

    // ReadSkillFlag(array[1], item);
    // ReadLuckOption(array[1], persistenceContext, item);
    // ReadNormalOption(array, persistenceContext, item);
    // ReadAncientOption(array[4], persistenceContext, item);
    // ReadLevel380Option(array[5], persistenceContext, item);
    // if (item.Definition.PossibleItemOptions.Any(o => o.PossibleOptions.Any(p => p.OptionType == ItemOptionTypes.BlackFenrir)))
    // {
    //     ReadFenrirOptions(array[3], persistenceContext, item);
    // }

    // if (item.Definition.MaximumSockets == 0)
    // {
    //     AddHarmonyOption(array[6], persistenceContext, item);
    // }
    // else
    // {
    //     ReadSocketBonus(array[6], persistenceContext, item);
    // }

    // ReadSockets(array.Slice(7), persistenceContext, item);
    return item;
  }
}

function ReadSkillFlag(optionByte: number, item: Item) {
  if ((optionByte & SkillFlag) == 0) {
    return;
  }

  // if (item.Definition!.Skill is null)
  // {
  //     throw new ArgumentException($"The skill flag was set, but a skill is not defined for the specified item ({item.Definition.Number}, {item.Definition.Group})");
  // }

  item.hasSkill = true;
}

function ReadLuckOption(optionByte: number, item: Item) {
  if ((optionByte & LuckFlag) == 0) {
    return;
  }

  // AddLuckOption(item);
}

function ReadWingOption(wingbyte: number, item: Item) {
  const wingBits = wingbyte & 0x0f;
  // ReadWingOptionBits(wingBits, item);
}

function ReadExcellentOption(excByte: number, item: Item) {
  const excellentBits = excByte & 0x3f;
  // ReadExcellentOptionBits(excellentBits, item);
}

function ReadNormalOption(array: Uint8Array, item: Item) {
  const optionLevel = (array[1] & 3) + ((array[3] >> 4) & 4);
  if (optionLevel == 0) {
    return;
  }

  // var itemIsWing = item.Definition!.PossibleItemOptions.Any(o => o.PossibleOptions.Any(i => i.OptionType == ItemOptionTypes.Wing));
  // var optionNumber = itemIsWing ? (array[3] >> 4) & 0b11 : 0;

  // AddNormalOption(optionNumber, optionLevel, persistenceContext, item);
}

function ReadAncientOption(ancientByte: number, item: Item) {
  if ((ancientByte & AncientMask) == 0) {
    return;
  }

  const bonusLevel = (ancientByte & AncientBonusLevelMask) >> 2;
  const setDiscriminator = ancientByte & AncientDiscriminatorMask;
  // AddAncientOption(setDiscriminator, bonusLevel, item);
}

function ReadLevel380Option(option380Byte: number, item: Item) {
  if ((option380Byte & GuardianOptionFlag) == 0) {
    return;
  }

  // AddLevel380Option(item);
}
