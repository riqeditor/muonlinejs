import { ArcRotateCamera, HighlightLayer } from '../libs/babylon/exports';
import {
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  Scene,
  Vector3,
} from '../libs/babylon/exports';
import { addInspectorForScene } from '../libs/babylon/utils';

export class TestScene extends Scene {
  defaultCamera: ArcRotateCamera;

  readonly hl: HighlightLayer;

  constructor(engine: Engine) {
    super(engine);

    const camera = new ArcRotateCamera(
      'ArcRotateCamera',
      -Math.PI / 4,
      Math.PI / 4.5,
      // thegame: 30% mais longe que o original (10); a rodinha do mouse ajusta (CameraFollowSystem).
      13,
      new Vector3(0, 0, 0),
      this
    );

    this.hl = new HighlightLayer('hl1', this, {
      isStroke: true,
      alphaBlendingMode: 1,
    });

    this.hl.innerGlow = false;

    camera.minZ = 0.1;
    camera.maxZ = 5000;
    camera.position.set(135, 10, 130);

    // camera.attachControl();
    // camera.keysUp.push(87);
    // camera.keysLeft.push(65);
    // camera.keysDown.push(83);
    // camera.keysRight.push(68);

    this.fogEnabled = false;
    this.fogStart = 1;
    this.fogEnd = 25;

    this.defaultCamera = camera;

    this.skipFrustumClipping = true;

    this.autoClearDepthAndStencil = true;
    this.autoClear = true;

    this.clearColor = new Color4(0, 0, 0, 1);
    this.ambientColor = new Color3(1, 1, 1);

    addInspectorForScene(this);

    const light2 = new DirectionalLight(
      'DirectionalLight2',
      new Vector3(0, 1, -2),
      this
    );
    light2.intensity = 3;

    const light3 = new HemisphericLight('light', new Vector3(0, 1, 0), this);
    light3.intensity = 1;
  }
}
