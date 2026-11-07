import {
  Color4,
  ParticleSystem,
  RawTexture,
  type Scene,
  Texture,
  Vector3,
} from '../libs/babylon/exports';
import { playFlame } from './flame';

// thegame: efeitos visuais das habilidades da 0.97d, feitos com partículas.
// Não recriam os efeitos originais do MU; dão a cada habilidade uma cara própria:
// projétil (magias/flechas), explosão na área, corte/giro (DK/MG) e brilho (buffs).

type Rgb = [number, number, number];

const COLORS: Record<string, Rgb> = {
  white: [1, 1, 1],
  blue: [0.35, 0.6, 1],
  cyan: [0.4, 1, 1],
  green: [0.4, 1, 0.4],
  poison: [0.45, 0.9, 0.25],
  orange: [1, 0.55, 0.15],
  red: [1, 0.25, 0.15],
  purple: [0.75, 0.35, 1],
  yellow: [1, 0.9, 0.35],
  gold: [1, 0.8, 0.3],
};

let glowTexture: Texture | null = null;

/** Círculo branco com degradê (textura gerada, sem arquivos). */
function getGlowTexture(scene: Scene): Texture {
  if (glowTexture) return glowTexture;
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - size / 2 + 0.5) / (size / 2);
      const dy = (y - size / 2 + 0.5) / (size / 2);
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      const a = Math.pow(1 - d, 2);
      const i = (y * size + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = 255;
      data[i + 3] = Math.round(a * 255);
    }
  }
  glowTexture = RawTexture.CreateRGBATexture(data, size, size, scene, false, false);
  return glowTexture;
}

function makeSystem(scene: Scene, capacity: number, color: Rgb, size: number, life: number) {
  const ps = new ParticleSystem('skill_fx', capacity, scene);
  ps.particleTexture = getGlowTexture(scene);
  ps.blendMode = ParticleSystem.BLENDMODE_ADD;
  ps.color1 = new Color4(color[0], color[1], color[2], 1);
  ps.color2 = new Color4(color[0] * 0.8, color[1] * 0.8, color[2] * 0.8, 1);
  ps.colorDead = new Color4(color[0] * 0.2, color[1] * 0.2, color[2] * 0.2, 0);
  ps.minSize = size * 0.6;
  ps.maxSize = size;
  ps.minLifeTime = life * 0.6;
  ps.maxLifeTime = life;
  // Não usar disposeOnStop: ele apaga também a textura, que é compartilhada por todos os
  // efeitos (o primeiro funcionava e os seguintes ficavam invisíveis).
  ps.onStoppedObservable.addOnce(() => ps.dispose(false));
  ps.gravity = Vector3.Zero();
  return ps;
}

/** Explosão de partículas em `pos`. */
export function burst(scene: Scene, pos: Vector3, color: Rgb, count = 40, speed = 3, size = 0.7, radius = 0.4) {
  const ps = makeSystem(scene, count, color, size, 0.55);
  ps.emitter = pos.clone();
  ps.createSphereEmitter(radius, 1);
  ps.minEmitPower = speed * 0.5;
  ps.maxEmitPower = speed;
  ps.manualEmitCount = count;
  ps.targetStopDuration = 0.8;
  ps.start();
}

/** Brilhos subindo (buffs/cura). */
export function rising(scene: Scene, pos: Vector3, color: Rgb) {
  const ps = makeSystem(scene, 60, color, 0.45, 1.1);
  ps.emitter = pos.clone();
  ps.createCylinderEmitter(0.6, 0.2, 0.1, 0);
  ps.direction1 = new Vector3(0, 1.5, 0);
  ps.direction2 = new Vector3(0, 2.5, 0);
  ps.minEmitPower = 1;
  ps.maxEmitPower = 1.5;
  ps.emitRate = 80;
  ps.targetStopDuration = 0.7;
  ps.start();
}

/** Anel de partículas abrindo em volta de `pos` (giros e golpes de área). */
export function ring(scene: Scene, pos: Vector3, color: Rgb, radius = 0.5, speed = 5) {
  const count = 70;
  const ps = makeSystem(scene, count, color, 0.6, 0.5);
  ps.emitter = pos.clone();
  ps.createCylinderEmitter(radius, 0.1, 0, 0);
  ps.minEmitPower = speed * 0.7;
  ps.maxEmitPower = speed;
  ps.startDirectionFunction = (_m, dir, particle) => {
    const angle = Math.random() * Math.PI * 2;
    dir.set(Math.cos(angle), 0.05, Math.sin(angle));
    void particle;
  };
  ps.manualEmitCount = count;
  ps.targetStopDuration = 0.6;
  ps.start();
}

/** Projétil que voa de `from` até `to` deixando rastro; explode ao chegar. */
export function projectile(
  scene: Scene,
  from: Vector3,
  to: Vector3,
  color: Rgb,
  { duration = 0.35, size = 0.8, impact = true }: { duration?: number; size?: number; impact?: boolean } = {}
) {
  const trail = makeSystem(scene, 120, color, size, 0.25);
  const emitter = from.clone();
  trail.emitter = emitter;
  trail.createSphereEmitter(0.08, 1);
  trail.minEmitPower = 0;
  trail.maxEmitPower = 0.3;
  trail.emitRate = 300;
  trail.start();

  const start = performance.now();
  const observer = scene.onBeforeRenderObservable.add(() => {
    const t = Math.min(1, (performance.now() - start) / (duration * 1000));
    Vector3.LerpToRef(from, to, t, emitter);
    if (t >= 1) {
      scene.onBeforeRenderObservable.remove(observer);
      trail.stop();
      if (impact) burst(scene, to, color, 25, 2.5, size * 0.8);
    }
  });
}

type EffectKind =
  | { type: 'projectile'; color: string; count?: number }
  | { type: 'area'; color: string; around?: boolean; big?: boolean }
  | { type: 'flame' }
  | { type: 'slash'; color: string }
  | { type: 'spin'; color: string }
  | { type: 'buff'; color: string };

/** Habilidades da 0.97d (número do OpenMU) -> efeito. */
const SKILL_EFFECTS: Record<number, EffectKind> = {
  // Dark Wizard / Soul Master
  1: { type: 'projectile', color: 'poison' }, // Poison
  2: { type: 'area', color: 'orange', big: true }, // Meteorite
  3: { type: 'projectile', color: 'cyan' }, // Lightning
  4: { type: 'projectile', color: 'orange' }, // Fire Ball
  5: { type: 'flame' }, // Flame
  6: { type: 'buff', color: 'purple' }, // Teleport
  7: { type: 'projectile', color: 'cyan' }, // Ice
  8: { type: 'area', color: 'white', big: true }, // Twister
  9: { type: 'area', color: 'purple', around: true, big: true }, // Evil Spirit
  10: { type: 'area', color: 'red', around: true, big: true }, // Hellfire
  11: { type: 'projectile', color: 'white' }, // Power Wave
  12: { type: 'projectile', color: 'cyan' }, // Aqua Beam
  13: { type: 'area', color: 'white', big: true }, // Cometfall
  14: { type: 'area', color: 'red', around: true, big: true }, // Inferno
  15: { type: 'buff', color: 'purple' }, // Teleport Ally
  16: { type: 'buff', color: 'blue' }, // Soul Barrier
  17: { type: 'projectile', color: 'blue' }, // Energy Ball
  // Dark Knight / Blade Knight
  19: { type: 'slash', color: 'white' }, // Falling Slash
  20: { type: 'slash', color: 'white' }, // Lunge
  21: { type: 'slash', color: 'white' }, // Uppercut
  22: { type: 'spin', color: 'white' }, // Cyclone
  23: { type: 'slash', color: 'white' }, // Slash
  41: { type: 'spin', color: 'blue' }, // Twisting Slash
  42: { type: 'area', color: 'orange', around: true }, // Rageful Blow
  43: { type: 'slash', color: 'red' }, // Death Stab
  47: { type: 'slash', color: 'white' }, // Impale
  48: { type: 'buff', color: 'green' }, // Swell Life
  // Elf / Muse Elf
  24: { type: 'projectile', color: 'yellow', count: 3 }, // Triple Shot
  26: { type: 'buff', color: 'green' }, // Heal
  27: { type: 'buff', color: 'blue' }, // Greater Defense
  28: { type: 'buff', color: 'red' }, // Greater Damage
  30: { type: 'buff', color: 'gold' }, // Summon Goblin
  51: { type: 'projectile', color: 'cyan' }, // Ice Arrow
  52: { type: 'projectile', color: 'yellow' }, // Penetration
  // Magic Gladiator
  55: { type: 'spin', color: 'orange' }, // Fire Slash
  56: { type: 'slash', color: 'cyan' }, // Power Slash
};

const DEFAULT_EFFECT: EffectKind = { type: 'slash', color: 'white' };

/**
 * Toca o efeito da habilidade. `from` = posição do lançador e `to` = alvo
 * (coordenadas da cena, já na altura do corpo).
 */
export function playSkillEffect(scene: Scene, skillNumber: number, from: Vector3, to: Vector3 | null) {
  const effect = SKILL_EFFECTS[skillNumber] ?? DEFAULT_EFFECT;
  const target = to ?? from;
  const color = 'color' in effect ? COLORS[effect.color] ?? COLORS.white : COLORS.white;

  switch (effect.type) {
    case 'projectile': {
      const count = effect.count ?? 1;
      for (let i = 0; i < count; i++) {
        const offset = (i - (count - 1) / 2) * 0.6;
        const side = new Vector3(-(target.z - from.z), 0, target.x - from.x).normalize().scale(offset);
        projectile(scene, from, target.add(side), color);
      }
      break;
    }
    case 'area':
      if (effect.around) ring(scene, from, color, 0.6, effect.big ? 7 : 5);
      burst(scene, effect.around ? from : target, color, effect.big ? 80 : 45, effect.big ? 5 : 3.5, 0.9, effect.big ? 1.5 : 0.6);
      break;
    case 'flame': {
      const flame = playFlame(scene, target.clone());
      setTimeout(() => flame.stop(), 900);
      break;
    }
    case 'slash':
      burst(scene, target, color, 30, 4, 0.6, 0.2);
      break;
    case 'spin':
      ring(scene, from, color, 0.4, 6);
      break;
    case 'buff':
      rising(scene, target.add(new Vector3(0, -0.8, 0)), color);
      break;
  }
}
