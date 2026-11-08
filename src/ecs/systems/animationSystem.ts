import type { IVector2Like } from '../../libs/babylon/exports';
import { MonsterActionType, PlayerAction } from '../../common/objects/enum';
import type { MUAttributeSystem } from '../../libs/attributeSystem';
import type { ISystemFactory } from '../world';
import type { PlayerObject } from '../../common/playerObject';
import { getStandWalkAction, getWeaponKind } from '../../common/weaponAnimations';
import type { Item } from '../world';

export const AnimationSystem: ISystemFactory = world => {
  const playersQuery = world.with(
    'playerAnimation',
    'modelObject',
    'attributeSystem',
    'movement'
  );

  const playerAnimatableQuery = world.with('modelObject', 'playerAnimation');
  const monsterAnimatableQuery = world.with(
    'modelObject',
    'monsterAnimation',
    'movement',
    'modelObject'
  );

  const animatableModelObjectsQuery = world.with('modelObject');

  function calculateAnimation(
    attributeSystem: MUAttributeSystem,
    velocity: IVector2Like,
    appearance?: { leftHand: Item | null; rightHand: Item | null }
  ) {
    const inSafeZone = attributeSystem.isAboveZero('inSafeZone');
    const isFemale = attributeSystem.isAboveZero('isFemale');
    const isFlying = attributeSystem.isAboveZero('isFlying');
    const isSwimming = attributeSystem.isAboveZero('isSwimming');
    const isSpearEquipped = attributeSystem.isAboveZero('isSpearEquipped');
    const isMoving = velocity.x !== 0 || velocity.y !== 0;

    //
    // Female player animations
    //

    if (inSafeZone) {
      if (isFemale) {
        if (isMoving) {
          return PlayerAction.PLAYER_WALK_FEMALE;
        }

        return PlayerAction.PLAYER_STOP_FEMALE;
      }

      if (isMoving) {
        return PlayerAction.PLAYER_WALK_MALE;
      }

      return PlayerAction.PLAYER_STOP_MALE;
    }

    // thegame: fora da safezone, pose e andar com a arma na mão (espada, arco, cajado…).
    if (appearance && !isFlying && !isSwimming) {
      const weaponAction = getStandWalkAction(getWeaponKind(appearance.leftHand, appearance.rightHand), isMoving);
      if (weaponAction !== null) return weaponAction;
    }

    if (isSpearEquipped) {
      if (isMoving) {
        if (isFlying) {
          return PlayerAction.PLAYER_FLY;
        }

        if (isSwimming) {
          return PlayerAction.PLAYER_WALK_SWIM;
        }

        return PlayerAction.PLAYER_WALK_SPEAR;
      }

      return PlayerAction.PLAYER_STOP_SPEAR;
    }

    if (isFemale) {
      if (isMoving) {
        if (isFlying) {
          return PlayerAction.PLAYER_FLY;
        }

        if (isSwimming) {
          return PlayerAction.PLAYER_WALK_SWIM;
        }

        return PlayerAction.PLAYER_WALK_FEMALE;
      }

      if (isFlying) {
        return PlayerAction.PLAYER_STOP_FLY;
      }

      if (isSwimming) {
        return PlayerAction.PLAYER_STOP_FEMALE;
      }

      return PlayerAction.PLAYER_STOP_FEMALE;
    }

    //
    // Male player animations
    //

    if (isMoving) {
      if (isFlying) {
        return PlayerAction.PLAYER_FLY;
      }

      if (isSwimming) {
        return PlayerAction.PLAYER_WALK_SWIM;
      }

      return PlayerAction.PLAYER_WALK_MALE;
    }

    if (isFlying) {
      return PlayerAction.PLAYER_STOP_FLY;
    }
    if (isSwimming) {
      return PlayerAction.PLAYER_STOP_MALE;
    }

    return PlayerAction.PLAYER_STOP_MALE;
  }

  return {
    update: () => {
      // calculate current anim
      for (const entity of playersQuery) {
        const { playerAnimation, movement, attributeSystem } = entity;
        // thegame: a morte fica até o renascer; outras animações "travadas" (ataque, golpe)
        // duram só até lockedUntil. Antes o ataque ficava preso para sempre.
        if (playerAnimation.action === PlayerAction.PLAYER_DIE1) {
          continue;
        }
        if (
          playerAnimation.lockedUntil !== undefined &&
          world.gameTime.TotalGameTime.TotalSeconds < playerAnimation.lockedUntil
        ) {
          continue;
        }
        playerAnimation.lockedUntil = undefined;
        playerAnimation.action = calculateAnimation(
          attributeSystem,
          movement.velocity,
          entity.charAppearance
        );
      }

      // update anim
      for (const { playerAnimation, modelObject } of playerAnimatableQuery) {
        const playerObject = modelObject as PlayerObject;
        if (!playerObject.Ready) continue;

        if (modelObject.ActionIterationWasFinished) {
        }

        if (
          playerAnimation.action >= PlayerAction.PLAYER_WALK_MALE &&
          playerAnimation.action <= PlayerAction.PLAYER_RUN_SWIM
        ) {
          playerObject.AnimationSpeed = 6; // TODO depends on movement speed;
        }

        playerObject.playAction(playerAnimation.action, true);

        if (playerObject.Wings) {
          if (playerObject.CurrentAction < 15) {
            playerObject.Wings.AnimationSpeed = 4;
          } else {
            playerObject.Wings.AnimationSpeed = 16;
          }
        }
      }

      //
      // Monsters
      //

      const now = world.gameTime.TotalGameTime.TotalSeconds;

      for (const entity of monsterAnimatableQuery) {
        const { monsterAnimation, movement, modelObject } = entity;

        // thegame: morto toca a morte uma vez e fica parado no último quadro.
        if (entity.dead || monsterAnimation.action === MonsterActionType.Die) {
          modelObject.playAction(MonsterActionType.Die, false);
          continue;
        }

        const isMoving = movement.velocity.x !== 0 || movement.velocity.y !== 0;
        const locked =
          monsterAnimation.lockedUntil !== undefined && now < monsterAnimation.lockedUntil;

        if (isMoving) {
          monsterAnimation.action = MonsterActionType.Walk;
        } else if (!locked) {
          // Parou de andar, ou o ataque/golpe terminou: volta para parado.
          monsterAnimation.lockedUntil = undefined;
          monsterAnimation.action = MonsterActionType.Stop1;
        }

        modelObject.playAction(monsterAnimation.action, true);
      }
    },
  };
};
