import { Matrix, Vector2, Vector3 } from '../../libs/babylon/exports';
import { EventBus } from '../../libs/eventBus';
import { Entity, ISystemFactory } from '../world';

const DIST = 10;

const DIST_SQUARED = DIST ** 2;

const ZERO_MATRIX = Matrix.Identity();

export const CalculateScreenPositionSystem: ISystemFactory = world => {
  const query = world.with('screenPosition', 'worldIndex', 'transform');

  const finalPosition = Vector3.Zero();
  const screenPosition = Vector3.Zero();

  const tmp1 = Vector3.Zero();
  const tmp2 = Vector3.Zero();

  const result = {
    entity: null as Entity | null,
    screenPosition: Vector2.Zero(),
  };

  const hiddenEntities = new Set<Entity>();

  query.onEntityRemoved.subscribe(e => {
    hiddenEntities.delete(e);
  });

  const scene = world.scene;

  // const rm = world.resourcesManager;
  const engine = scene.getEngine();

  return {
    update: () => {
      const terrain = world.terrain;
      if (!terrain) return;
      const playerEntity = world.playerEntity;

      if (!playerEntity) return;

      const camera = scene.activeCamera;
      if (!camera) return;

      camera.viewport.toGlobalToRef(
        engine.getRenderWidth(),
        engine.getRenderHeight(),
        world.viewport
      );
      const projMatrix = scene.getTransformMatrix();

      const ratio = 1 / (engine._hardwareScalingLevel || 1);

      tmp1.x = playerEntity.transform.pos.x;
      tmp1.y = playerEntity.transform.pos.y;
      tmp1.z = playerEntity.transform.pos.z;

      query.entities.forEach(entity => {
        if (world.mapIndex !== entity.worldIndex) {
          if (!hiddenEntities.has(entity)) {
            hiddenEntities.add(entity);
            result.entity = entity;
            entity.screenPosition.x = entity.screenPosition.y = 0;
            result.screenPosition.copyFrom(entity.screenPosition);
            EventBus.emit('entityScreenPositionUpdated', result as any);
          }
          return;
        }

        // if (entity.enabled !== true) {
        //   if (!hiddenEntities.has(entity.id)) {
        //     hiddenEntities.add(entity.id);
        //     result.id = entity.id;
        //     entity.screenPosition.x = entity.screenPosition.y = 0;
        //     result.screenPosition.copyFrom(entity.screenPosition);
        //     bus.onEntityScreenPositionUpdated.notifyObservers(result);
        //   }
        //   return;
        // }

        screenPosition.setAll(0);

        // thegame: na cena a altura é o eixo Y (x = X do mapa, z = Y do mapa). O código
        // antigo somava a altura do rótulo em Z e invertia Y (256 - y), e os rótulos
        // (nomes, números de dano) caíam fora da tela.
        const position = entity.transform.pos;
        const offset = entity.transform.posOffset;
        finalPosition.x = position.x + (offset?.x ?? 0);
        finalPosition.y = position.y + entity.screenPosition.worldOffsetZ;
        finalPosition.z = position.z + (offset?.z ?? 0);

        tmp2.copyFrom(finalPosition);

        const distSquared = Vector3.DistanceSquared(tmp1, tmp2);

        let distToCompare = DIST_SQUARED;

        // if (entity.screenPositionDistSqrt != null) {
        //   distToCompare = entity.screenPositionDistSqrt;
        // }

        if (distSquared < distToCompare) {
          Vector3.ProjectToRef(
            finalPosition,
            ZERO_MATRIX,
            projMatrix,
            world.viewport,
            screenPosition
          );
        }

        const scrPos = entity.screenPosition;

        scrPos.x = screenPosition.x / ratio;
        scrPos.y = screenPosition.y / ratio;

        result.entity = entity;
        result.screenPosition.copyFrom(scrPos);

        const uiDistSqrt = scrPos.x * scrPos.x + scrPos.y * scrPos.y;

        const isHidden = uiDistSqrt < 0.1;

        if (isHidden) {
          if (!hiddenEntities.has(entity)) {
            hiddenEntities.add(entity);
            EventBus.emit('entityScreenPositionUpdated', result as any);
          }

          return;
        }

        hiddenEntities.delete(entity);

        EventBus.emit('entityScreenPositionUpdated', result as any);
      });
    },
  };
};
