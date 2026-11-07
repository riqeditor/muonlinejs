import { Vector3, type ArcRotateCamera } from '../../libs/babylon/exports';
import type { ISystemFactory } from '../world';

const v3Temp = Vector3.Zero();

// thegame: zoom com a rodinha do mouse (só quando o mouse está sobre o jogo, não sobre painéis).
const MIN_CAMERA_DISTANCE = 7;
const MAX_CAMERA_DISTANCE = 22;
const ZOOM_STEP = 1;

export const CameraFollowSystem: ISystemFactory = world => {
  const scene = world.scene;

  const canvas = scene.getEngine().getRenderingCanvas();
  canvas?.addEventListener(
    'wheel',
    ev => {
      const camera = scene.activeCamera as ArcRotateCamera | null;
      if (!camera || camera.radius === undefined) return;
      const next = camera.radius + Math.sign(ev.deltaY) * ZOOM_STEP;
      camera.radius = Math.min(MAX_CAMERA_DISTANCE, Math.max(MIN_CAMERA_DISTANCE, next));
    },
    { passive: true }
  );

  return {
    update: () => {
      const camera = scene.activeCamera as ArcRotateCamera;

      if (!camera) return;

      const playerEntity = world.playerEntity;
      if (!playerEntity) return;

      v3Temp.copyFrom(playerEntity.transform.pos as any);

      if (playerEntity.transform.posOffset !== undefined) {
        v3Temp.addInPlace(playerEntity.transform.posOffset as any);
      }

      camera.target.copyFrom(v3Temp);
    },
  };
};
