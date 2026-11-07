import { TWFlags } from '../../common/terrain/consts';
import { isFlagInBinaryMask } from '../../common/utils';
import { Scalar } from '../../libs/babylon/exports';
import { Store } from '../../store';
import type { ISystemFactory } from '../world';

export const MoveAlongPathSystem: ISystemFactory = world => {
  const query = world.with('transform', 'pathfinding', 'movement');

  return {
    update: (deltaTime: number) => {
      for (const {
        pathfinding,
        transform,
        movement,
        localPlayer,
        attributeSystem,
      } of query) {
        if (localPlayer) {
          Store.playerData.setPosition(~~transform.pos.x, ~~transform.pos.z);

          const flag = world.getTerrainFlag(
            ~~transform.pos.x,
            ~~transform.pos.z
          );
          Store.playerData.setTileFlag(flag);
        }

        const speed = attributeSystem?.getValue('totalMovementSpeed') ?? 4;
        let deltaSpeed = speed * deltaTime;

        if (
          !pathfinding.path ||
          pathfinding.path.length === 0 ||
          !pathfinding.calculated
        ) {
          movement.velocity.x = 0;
          movement.velocity.y = 0;

          continue;
        }

        while (deltaSpeed > 0 && pathfinding.path.length > 0) {
          let nextPoint = pathfinding.path[0];
          let dx = nextPoint.x - transform.pos.x;
          let dy = nextPoint.y - transform.pos.z;
          const distance = Math.sqrt(dx * dx + dy * dy);

          const deltaDistance = Math.min(deltaSpeed, distance);
          deltaSpeed -= deltaDistance;

          if (deltaDistance === distance) {
            pathfinding.path.shift();

            // if (pathfinding.path.length === 0) {
            //   movement.velocity.x = 0;
            //   movement.velocity.y = 0;

            //   break;
            // }

            if (distance < 0.00001) continue;
          }

          movement.velocity.x = (dx / distance) * speed;
          movement.velocity.y = (dy / distance) * speed;

          const deltaX = (dx / distance) * deltaDistance;
          const deltaY = (dy / distance) * deltaDistance;

          transform.pos.x += deltaX;
          transform.pos.z += deltaY;

          if (world.terrain) {
            const h1 = world.getTerrainHeight(
              ~~transform.pos.x,
              ~~transform.pos.z
            );
            const h2 = world.getTerrainHeight(
              ~~transform.pos.x,
              ~~transform.pos.z
            );
            const h3 = world.getTerrainHeight(
              ~~transform.pos.x + 1,
              ~~transform.pos.z
            );
            const h4 = world.getTerrainHeight(
              ~~transform.pos.x + 1,
              ~~transform.pos.z + 1
            );
            const h = Scalar.Lerp(
              Scalar.Lerp(h1, h2, 0.5),
              Scalar.Lerp(h3, h4, 0.5),
              0.5
            );
            // thegame: o fator nunca pode passar de 1, senão a interpolação extrapola.
            transform.pos.y = Scalar.Lerp(
              transform.pos.y,
              h,
              Math.min(1, 15 * deltaTime)
            );

            if (attributeSystem) {
              const flag = world.getTerrainFlag(
                ~~transform.pos.x,
                ~~transform.pos.z
              );
              attributeSystem.setValue(
                'inSafeZone',
                isFlagInBinaryMask(flag, TWFlags.SafeZone) ? 1 : 0
              );
            }
          }

          transform.rot.y =
            Math.atan2(movement.velocity.y, movement.velocity.x) + Math.PI / 2;
        }
      }
    },
  };
};
