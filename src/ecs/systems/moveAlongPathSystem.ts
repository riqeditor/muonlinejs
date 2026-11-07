import { TWFlags } from '../../common/terrain/consts';
import { isFlagInBinaryMask } from '../../common/utils';
import { Scalar } from '../../libs/babylon/exports';
import { Store } from '../../store';
import type { ISystemFactory } from '../world';

/** thegame: altura do chão onde o modelo é desenhado (posição + posOffset). */
export function groundHeightAt(
  world: { getTerrainHeight: (x: number, y: number) => number },
  transform: { pos: { x: number; z: number }; posOffset?: { x: number; z: number } }
): number {
  return world.getTerrainHeight(
    transform.pos.x + (transform.posOffset?.x ?? 0),
    transform.pos.z + (transform.posOffset?.z ?? 0)
  );
}

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

          // thegame: parado também fica exatamente no chão (ex.: outro jogador que
          // chegou já parado numa rampa ficava com os pés enterrados).
          if (world.terrain) {
            transform.pos.y = groundHeightAt(world, transform);
          }
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
            // thegame: altura do chão no ponto exato onde o modelo é desenhado (posição +
            // posOffset), com interpolação bilinear. Antes era uma média de cantos do
            // quadrado sem o offset, e numa rampa os pés afundavam no chão.
            const h = groundHeightAt(world, transform);
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
