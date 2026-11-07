import { CharacterClassNumber } from './types';
import { CharacterCreationUnlockFlagsEnum } from './packets/ServerToClientPackets';

/** Nomes das classes como aparecem no MU Online (Season 6). */
export const CHARACTER_CLASS_NAMES: Record<CharacterClassNumber, string> = {
  [CharacterClassNumber.DarkWizard]: 'Dark Wizard',
  [CharacterClassNumber.SoulMaster]: 'Soul Master',
  [CharacterClassNumber.GrandMaster]: 'Grand Master',
  [CharacterClassNumber.DarkKnight]: 'Dark Knight',
  [CharacterClassNumber.BladeKnight]: 'Blade Knight',
  [CharacterClassNumber.BladeMaster]: 'Blade Master',
  [CharacterClassNumber.FairyElf]: 'Fairy Elf',
  [CharacterClassNumber.MuseElf]: 'Muse Elf',
  [CharacterClassNumber.HighElf]: 'High Elf',
  [CharacterClassNumber.MagicGladiator]: 'Magic Gladiator',
  [CharacterClassNumber.DuelMaster]: 'Duel Master',
  [CharacterClassNumber.DarkLord]: 'Dark Lord',
  [CharacterClassNumber.LordEmperor]: 'Lord Emperor',
  [CharacterClassNumber.Summoner]: 'Summoner',
  [CharacterClassNumber.BloodySummoner]: 'Bloody Summoner',
  [CharacterClassNumber.DimensionMaster]: 'Dimension Master',
  [CharacterClassNumber.RageFighter]: 'Rage Fighter',
  [CharacterClassNumber.FistMaster]: 'Fist Master',
};

/**
 * Lê a classe dos dados de aparência (Season 6). O OpenMU grava
 * `CharacterClass.Number << 3` no primeiro byte (AppearanceSerializer.cs),
 * então os 5 bits de cima já são o CharacterClassNumber.
 */
export function getClassFromAppearance(appearance: DataView): CharacterClassNumber {
  return (appearance.getUint8(0) >> 3) & 0x1f;
}

export function getCharacterClassName(cls: CharacterClassNumber): string {
  return CHARACTER_CLASS_NAMES[cls] ?? `Classe ${cls}`;
}

/** Classes que toda conta pode criar. */
const BASE_CLASSES = [
  CharacterClassNumber.DarkKnight,
  CharacterClassNumber.DarkWizard,
  CharacterClassNumber.FairyElf,
];

/**
 * Classes extras e a flag que o servidor envia quando a conta pode criá-las
 * (C1 F3 00 CharacterList.UnlockFlags e C1 DE 00 CharacterClassCreationUnlock).
 */
const UNLOCKABLE_CLASSES: [CharacterClassNumber, CharacterCreationUnlockFlagsEnum][] = [
  [CharacterClassNumber.MagicGladiator, CharacterCreationUnlockFlagsEnum.MagicGladiator],
  [CharacterClassNumber.DarkLord, CharacterCreationUnlockFlagsEnum.DarkLord],
  [CharacterClassNumber.Summoner, CharacterCreationUnlockFlagsEnum.Summoner],
  [CharacterClassNumber.RageFighter, CharacterCreationUnlockFlagsEnum.RageFighter],
];

/** Lista das classes que a conta pode criar, de acordo com as flags do servidor. */
export function getCreatableClasses(unlockFlags: number): CharacterClassNumber[] {
  const unlocked = UNLOCKABLE_CLASSES.filter(([, flag]) => (unlockFlags & flag) !== 0).map(
    ([cls]) => cls
  );
  return [...BASE_CLASSES, ...unlocked];
}
