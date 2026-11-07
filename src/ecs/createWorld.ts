import { RenderSystem } from './systems/renderSystem';
import { World, type ISystemFactory } from './world';
import { PathfindingSystem } from './systems/pathfindingSystem';
import { PlayerControllerSystem } from './systems/playerControllerSystem';
import { MoveAlongPathSystem } from './systems/moveAlongPathSystem';
import { AnimationSystem } from './systems/animationSystem';
import { ModelLoaderSystem } from './systems/modelLoaderSystem';
import { CameraFollowSystem } from './systems/cameraFollowSystem';
import { NetworkSystem } from './systems/networkSystem';
import { OutOfScopeSystem } from './systems/outOfScopeSystem';
import { CalculateVisibilitySystem } from './systems/calculateVisibilitySystem';
import { CalculateScreenPositionSystem } from './systems/calculateScreenPositionSystem';
import { AppearanceSystem } from './systems/appearanceSystem';
import { DrawDebugSystem } from './systems/drawDebugSystem';
import { HighlightSystem } from './systems/highlightSystem';
import type { TestScene } from '../scenes/testScene';
import { PointerInputSystem } from './systems/pointerInputSystem';
import { KeyboardInputSystem } from './systems/keyboardInputSystem';
import { BackgroundMusicSystem } from './systems/backgroundMusicSystem';
import { InteractiveAreaSystem } from './systems/interactiveAreaSystem';
import { WalkSfxSystem } from './systems/walkSfxSystem';
import { CombatSystem } from './systems/combatSystem';
import { PickupSystem } from './systems/pickupSystem';

const factories: ISystemFactory[] = [
  ModelLoaderSystem,
  PointerInputSystem,
  KeyboardInputSystem,
  InteractiveAreaSystem,
  PlayerControllerSystem,
  CombatSystem,
  PickupSystem,
  PathfindingSystem,
  CalculateVisibilitySystem,
  CalculateScreenPositionSystem,
  NetworkSystem,
  MoveAlongPathSystem,
  HighlightSystem,
  AnimationSystem,
  AppearanceSystem,
  WalkSfxSystem,
  CameraFollowSystem,
  OutOfScopeSystem,
  BackgroundMusicSystem,
  DrawDebugSystem,
  RenderSystem,
];

export function createWorld(scene: TestScene) {
  const world = new World(scene);

  const systems = factories.map(f => f(world));

  return {
    world,
    updateSystems: (dt: number) => {
      systems.forEach(system => {
        system.update?.(dt);
      });
    },
  } as const;
}
