import { CharacterClassNumber } from '../../common';
import { directionTo, directionToAngle, tileDistance } from '../../common/direction';
import { MONSTER_MODELS } from '../../common/monsters/monsterModels';
import { PlayerAction } from '../../common/objects/enum';
import { Store } from '../../store';
import type { Entity, ISystemFactory, World } from '../world';

// thegame: ataque básico do jogador local.
// Clicar num monstro define o alvo (PlayerControllerSystem). Este sistema anda até
// ficar perto, vira para o alvo e envia C1 11 HitRequest a cada ATTACK_INTERVAL,
// até o alvo morrer, sumir ou o jogador clicar em outro lugar.

/** Tempo entre golpes (s). O OpenMU valida a velocidade de ataque; 0,7 s é seguro. */
const ATTACK_INTERVAL = 0.7;
/** Quanto tempo a animação de ataque fica travada (s). */
const ATTACK_ANIMATION_TIME = 0.6;
/** De quanto em quanto tempo recalcular o caminho até o alvo (s). */
const CHASE_REPATH_INTERVAL = 0.5;

const MELEE_RANGE = 2;
const BOW_RANGE = 6;

const ELF_CLASSES = new Set<CharacterClassNumber>([
  CharacterClassNumber.FairyElf,
  CharacterClassNumber.MuseElf,
  CharacterClassNumber.HighElf,
]);

/** Monstros (não NPCs/guardas) vivos podem ser atacados. */
export function isAttackable(entity: Entity | null | undefined): boolean {
  if (!entity || entity.npcType === undefined || entity.netId === undefined) return false;
  if (entity.dead || entity.objOutOfScope) return false;
  const kind = MONSTER_MODELS[entity.npcType]?.[1];
  return kind === 'monster' || kind === 'trap';
}

function getAttackRange(world: World): number {
  const cls = world.playerEntity?.attributeSystem?.getValue('playerNetClass') as
    | CharacterClassNumber
    | undefined;
  return cls !== undefined && ELF_CLASSES.has(cls) ? BOW_RANGE : MELEE_RANGE;
}

export const CombatSystem: ISystemFactory = world => {
  let cooldown = 0;
  let repathTimer = 0;

  return {
    update: dt => {
      cooldown -= dt;
      repathTimer -= dt;

      const player = world.playerEntity;
      const targetId = world.attackTargetNetId;
      if (!player || targetId === null) return;

      if (Store.playerDead) {
        world.attackTargetNetId = null;
        return;
      }

      const target = world.netObjsQuery.entities.find(e => e.netId === targetId);
      if (!target || !isAttackable(target)) {
        world.attackTargetNetId = null;
        return;
      }

      const px = player.transform.pos.x;
      const py = player.transform.pos.z;
      const tx = target.transform.pos.x;
      const ty = target.transform.pos.z;

      if (tileDistance(px, py, tx, ty) > getAttackRange(world)) {
        // Longe: anda até o alvo (o caminho é recalculado porque o monstro se mexe).
        if (repathTimer <= 0) {
          repathTimer = CHASE_REPATH_INTERVAL;
          player.playerMoveTo.point.x = Math.floor(tx) + 0.5;
          player.playerMoveTo.point.y = Math.floor(ty) + 0.5;
          player.playerMoveTo.handled = false;
          player.playerMoveTo.sendToServer = true;
        }
        return;
      }

      // Perto: para de andar e ataca.
      if (player.pathfinding.path && player.pathfinding.path.length > 0) {
        player.pathfinding.path = [];
      }

      const direction = directionTo(px, py, tx, ty);
      player.transform.rot.y = directionToAngle(direction);

      if (cooldown > 0) return;
      cooldown = ATTACK_INTERVAL;

      Store.sendHitRequest(targetId, direction);

      player.playerAnimation.action = PlayerAction.PLAYER_ATTACK_FIST;
      player.playerAnimation.lockedUntil =
        world.gameTime.TotalGameTime.TotalSeconds + ATTACK_ANIMATION_TIME;
    },
  };
};
