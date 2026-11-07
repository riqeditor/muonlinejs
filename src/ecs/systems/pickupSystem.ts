import { tileDistance } from '../../common/direction';
import { EventBus } from '../../libs/eventBus';
import { Store } from '../../store';
import type { Entity, ISystemFactory, World } from '../world';

// thegame: pegar itens/zen do chão. Clicar num item (ou perto dele) ou apertar Espaço
// define o alvo; este sistema anda até o item e envia C3 22 PickupItemRequest.

/** Distância (em quadrados) para conseguir pegar. */
const PICKUP_RANGE = 1;
/** Espaço pega o item mais perto dentro deste raio. */
const SPACE_PICKUP_RADIUS = 4;
/** Clique conta como "no item" se cair até esta distância dele. */
export const CLICK_PICKUP_RADIUS = 1;
const REPATH_INTERVAL = 0.5;

function groundItems(world: World): Entity[] {
  return world.netObjsQuery.entities.filter(e => e.groundItem && !e.objOutOfScope);
}

/** Item no chão mais perto de (x, y), até `radius` quadrados. */
export function findGroundItemNear(world: World, x: number, y: number, radius: number) {
  let best: Entity | null = null;
  let bestDistance = Infinity;
  for (const item of groundItems(world)) {
    const d = tileDistance(x, y, item.transform!.pos.x, item.transform!.pos.z);
    if (d <= radius && d < bestDistance) {
      best = item;
      bestDistance = d;
    }
  }
  return best;
}

export const PickupSystem: ISystemFactory = world => {
  let repathTimer = 0;

  EventBus.on('keyPressed', code => {
    if (code !== 'Space' || Store.playerDead) return;
    const player = world.playerEntity;
    if (!player) return;
    const item = findGroundItemNear(
      world,
      player.transform.pos.x,
      player.transform.pos.z,
      SPACE_PICKUP_RADIUS
    );
    if (item?.netId !== undefined) {
      world.attackTargetNetId = null;
      world.pickupTargetNetId = item.netId;
    }
  });

  return {
    update: dt => {
      repathTimer -= dt;

      const player = world.playerEntity;
      const targetId = world.pickupTargetNetId;
      if (!player || targetId === null) return;

      const item = world.netObjsQuery.entities.find(
        e => e.netId === targetId && e.groundItem && !e.objOutOfScope
      );
      if (!item || Store.playerDead) {
        world.pickupTargetNetId = null;
        return;
      }

      const ix = item.transform!.pos.x;
      const iy = item.transform!.pos.z;

      if (tileDistance(player.transform.pos.x, player.transform.pos.z, ix, iy) <= PICKUP_RANGE) {
        Store.sendPickupItem(targetId);
        world.pickupTargetNetId = null;
        return;
      }

      if (repathTimer <= 0) {
        repathTimer = REPATH_INTERVAL;
        player.playerMoveTo.point.x = Math.floor(ix) + 0.5;
        player.playerMoveTo.point.y = Math.floor(iy) + 0.5;
        player.playerMoveTo.handled = false;
        player.playerMoveTo.sendToServer = true;
      }
    },
  };
};
