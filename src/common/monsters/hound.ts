import { loadGLTF } from '../modelLoader';
import type { World } from '../../ecs/world';
import { MonsterObject } from '../monsterObject';

// [NpcInfo(1, "Hound")]
export class Hound extends MonsterObject {
  static {
    Hound.OverrideScale = 0.85;
  }

  async init(world: World) {
    const bmd = await loadGLTF('Monster/Monster02.glb', world);

    super.load(bmd);
  }
}
