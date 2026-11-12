import { PlayerAction } from './objects/enum';
import type { Item } from '../ecs/world';

// thegame: animações conforme a arma equipada, como no cliente original do MU.
// Slot 0 (charAppearance.leftHand) = arma principal (mão direita do modelo);
// slot 1 (charAppearance.rightHand) = escudo / segunda arma / arco.

export type WeaponKind = 'none' | 'sword' | 'dual' | 'spear' | 'scythe' | 'bow' | 'crossbow' | 'staff';

const BOWS = new Set([0, 1, 2, 3, 4, 5, 6, 17, 20, 21, 22, 23]);
const CROSSBOWS = new Set([8, 9, 10, 11, 12, 13, 14, 16, 18, 19]);
// Lanças de "foice/alabarda" (Double Poleaxe, Halberd, Berdysh, Great Scythe, Bill of Balrog).
const SCYTHES = new Set([5, 6, 7, 8, 9]);

const isMelee = (item: Item | null) => !!item && item.group >= 0 && item.group <= 2;

export function getWeaponKind(main: Item | null, off: Item | null): WeaponKind {
  for (const item of [main, off]) {
    if (item?.group === 4) {
      if (BOWS.has(item.num)) return 'bow';
      if (CROSSBOWS.has(item.num)) return 'crossbow';
    }
  }
  if (!main) return isMelee(off) ? 'sword' : 'none';
  if (isMelee(main)) return isMelee(off) ? 'dual' : 'sword';
  if (main.group === 3) return SCYTHES.has(main.num) ? 'scythe' : 'spear';
  if (main.group === 5) return 'staff';
  return 'none';
}

/** Ataque normal. `alternate` alterna entre os dois golpes (ou as duas mãos). */
export function getAttackAction(kind: WeaponKind, alternate: boolean, riding = false): PlayerAction {
  if (riding) {
    switch (kind) {
      case 'spear':
        return PlayerAction.PLAYER_ATTACK_RIDE_SPEAR;
      case 'scythe':
        return PlayerAction.PLAYER_ATTACK_RIDE_SCYTHE;
      case 'bow':
        return PlayerAction.PLAYER_ATTACK_RIDE_BOW;
      case 'crossbow':
        return PlayerAction.PLAYER_ATTACK_RIDE_CROSSBOW;
      case 'none':
        break;
      default:
        return PlayerAction.PLAYER_ATTACK_RIDE_SWORD;
    }
  }
  switch (kind) {
    case 'sword':
    case 'staff':
      return alternate ? PlayerAction.PLAYER_ATTACK_SWORD_RIGHT2 : PlayerAction.PLAYER_ATTACK_SWORD_RIGHT1;
    case 'dual':
      return alternate ? PlayerAction.PLAYER_ATTACK_SWORD_LEFT1 : PlayerAction.PLAYER_ATTACK_SWORD_RIGHT1;
    case 'spear':
      return PlayerAction.PLAYER_ATTACK_SPEAR1;
    case 'scythe':
      return alternate ? PlayerAction.PLAYER_ATTACK_SCYTHE2 : PlayerAction.PLAYER_ATTACK_SCYTHE1;
    case 'bow':
      return PlayerAction.PLAYER_ATTACK_BOW;
    case 'crossbow':
      return PlayerAction.PLAYER_ATTACK_CROSSBOW;
    default:
      return PlayerAction.PLAYER_ATTACK_FIST;
  }
}

/** Animação ao usar uma habilidade: magia com as mãos, arco atira, armas golpeiam. */
export function getSkillAction(kind: WeaponKind, alternate: boolean, isMagic: boolean, riding = false): PlayerAction {
  if (kind === 'bow' || kind === 'crossbow') return getAttackAction(kind, alternate, riding);
  if (isMagic || kind === 'none') return alternate ? PlayerAction.PLAYER_SKILL_HAND2 : PlayerAction.PLAYER_SKILL_HAND1;
  return getAttackAction(kind, alternate, riding);
}

/** Pose parada e andar com a arma na mão (fora da safezone). `null` = usar a normal. */
export function getStandWalkAction(kind: WeaponKind, moving: boolean): PlayerAction | null {
  switch (kind) {
    case 'sword':
    case 'dual':
      return moving ? PlayerAction.PLAYER_WALK_SWORD : PlayerAction.PLAYER_STOP_SWORD;
    case 'staff':
      return moving ? PlayerAction.PLAYER_WALK_WAND : PlayerAction.PLAYER_STOP_WAND;
    case 'spear':
      return moving ? PlayerAction.PLAYER_WALK_SPEAR : PlayerAction.PLAYER_STOP_SPEAR;
    case 'scythe':
      return moving ? PlayerAction.PLAYER_WALK_SCYTHE : PlayerAction.PLAYER_STOP_SCYTHE;
    case 'bow':
      return moving ? PlayerAction.PLAYER_WALK_BOW : PlayerAction.PLAYER_STOP_BOW;
    case 'crossbow':
      return moving ? PlayerAction.PLAYER_WALK_CROSSBOW : PlayerAction.PLAYER_STOP_CROSSBOW;
    default:
      return null;
  }
}
