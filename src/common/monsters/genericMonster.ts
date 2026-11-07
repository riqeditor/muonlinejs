import type { World } from '../../ecs/world';
import { loadGLTF } from '../modelLoader';
import type { ModelObject } from '../modelObject';
import { MonsterObject } from '../monsterObject';
import { MonsterActionType } from '../objects/enum';
import { MONSTER_MODELS, type MonsterModelAnimationSpeeds } from './monsterModels';

// thegame: monstros e NPCs sem classe própria em ModelFactoryPerId apareciam com o
// modelo padrão de personagem (o "DK pelado"). Aqui cada número ganha uma classe que
// carrega o modelo certo da tabela MONSTER_MODELS.

const ACTION_BY_KEY: Record<keyof MonsterModelAnimationSpeeds, MonsterActionType> = {
  stop1: MonsterActionType.Stop1,
  stop2: MonsterActionType.Stop2,
  walk: MonsterActionType.Walk,
  attack1: MonsterActionType.Attack1,
  attack2: MonsterActionType.Attack2,
  shock: MonsterActionType.Shock,
  die: MonsterActionType.Die,
  appear: MonsterActionType.Appear,
  attack3: MonsterActionType.Attack3,
  attack4: MonsterActionType.Attack4,
  run: MonsterActionType.Run,
};

const cache = new Map<number, typeof ModelObject>();

export function getGenericModelFactory(typeNumber: number): typeof ModelObject | undefined {
  const cached = cache.get(typeNumber);
  if (cached) return cached;

  const entry = MONSTER_MODELS[typeNumber];
  if (!entry) return undefined;

  const [file, , , animationSpeeds] = entry;

  class GenericMonster extends MonsterObject {
    async init(world: World) {
      this.load(await loadGLTF(file, world));

      if (animationSpeeds) {
        for (const [key, speed] of Object.entries(animationSpeeds)) {
          const action = ACTION_BY_KEY[key as keyof MonsterModelAnimationSpeeds];
          if (action !== undefined && speed !== undefined) {
            this.setActionSpeed(action, speed);
          }
        }
      }
    }
  }

  cache.set(typeNumber, GenericMonster);
  return GenericMonster;
}

export function getMonsterModelName(typeNumber: number): string | undefined {
  return MONSTER_MODELS[typeNumber]?.[2];
}
