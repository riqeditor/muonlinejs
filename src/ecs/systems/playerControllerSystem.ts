import {
  CreateBox,
  PointerEventTypes,
  StandardMaterial,
} from '../../libs/babylon/exports';
import type { ISystemFactory } from '../world';

const MOVE_DELAY = 0.25;

export const PlayerControllerSystem: ISystemFactory = world => {
  const query = world.with('playerMoveTo', 'transform', 'pathfinding');

  const size = 0.75;
  const box = CreateBox(
    'playerControllerBox',
    { width: size, depth: size, height: 0.02 },
    world.scene
  );
  box.setParent(world.mapParent);
  box.isPickable = false;
  box.alwaysSelectAsActiveMesh = true;
  box.material = new StandardMaterial(
    'playerControllerBoxMaterial',
    world.scene
  );
  box.material.alpha = 0.25;

  const scene = world.scene;

  let lastClientX = 0;
  let lastClientY = 0;
  // thegame: um clique (ou toque) rápido pode começar e terminar entre dois frames,
  // e aí `world.pointerPressed` nunca é visto como true. Guarda o clique para o próximo frame.
  let pendingClick = false;

  scene.onPointerObservable.add(ev => {
    if (
      ev.type === PointerEventTypes.POINTERMOVE ||
      ev.type === PointerEventTypes.POINTERDOWN
    ) {
      lastClientX = ev.event.clientX;
      lastClientY = ev.event.clientY;
    }

    if (
      ev.type === PointerEventTypes.POINTERDOWN &&
      (ev.event as PointerEvent).button === 0
    ) {
      pendingClick = true;
    }
  });

  let delay = MOVE_DELAY;
  function tryMove() {
    const playerEntity = world.playerEntity;
    if (!playerEntity) return;

    const pickInfo = scene.pick(
      lastClientX,
      lastClientY,
      m => m === world.terrain?.mesh,
      true
    );

    if (!pickInfo) return;

    const point = pickInfo.pickedPoint;

    if (!point) return;

    if (point.lengthSquared() < 0.01) return;

    const x = ~~point.x;
    const z = ~~point.z;

    if (!world.isWalkable(x, z)) return;

    // console.log(JSON.stringify(point), x, y);

    playerEntity.playerMoveTo.point.x = point.x;
    playerEntity.playerMoveTo.point.y = point.z;
    playerEntity.playerMoveTo.handled = false;
    playerEntity.playerMoveTo.sendToServer = true;
  }

  return {
    update: dt => {
      delay -= dt;

      if (pendingClick) {
        pendingClick = false;
        delay = MOVE_DELAY;
        tryMove();
      } else if (world.pointerPressed) {
        if (delay <= 0) {
          delay = MOVE_DELAY;
          tryMove();
        }
      }

      for (const {
        playerMoveTo,
        transform,
        pathfinding,
        localPlayer,
      } of query) {
        if (playerMoveTo.handled) continue;

        playerMoveTo.handled = true;

        pathfinding.calculated = false;

        pathfinding.from.x = transform.pos.x;
        pathfinding.from.y = transform.pos.z;

        pathfinding.to.x = ~~playerMoveTo.point.x;
        pathfinding.to.y = ~~playerMoveTo.point.y;

        if (localPlayer) {
          box.position.x = ~~playerMoveTo.point.x + 0.5;
          box.position.z = ~~playerMoveTo.point.y + 0.5;
          box.position.y =
            world.getTerrainHeight(playerMoveTo.point.x, playerMoveTo.point.y) +
            0.02;
        }
      }
    },
  };
};
