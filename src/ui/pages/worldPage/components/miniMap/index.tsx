import './style.less';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import { Store } from '../../../../../store';
import { EventBus } from '../../../../../libs/eventBus';
import { MONSTER_MODELS } from '../../../../../common/monsters/monsterModels';
import { TWFlags } from '../../../../../common/terrain/consts';
import type { World } from '../../../../../ecs/world';

// thegame: minimapa. Desenhado com os dados do terreno que o jogo já carrega (andável,
// parede, safezone), sem imagens do cliente original. Fica girado como a câmera, então
// "para cima" no minimapa é "para cima" na tela. Tab alterna entre pequeno e grande.

const MAP_SIZE = 256;

const MAP_NAMES: Record<number, string> = {
  0: 'Lorencia',
  1: 'Dungeon',
  2: 'Devias',
  3: 'Noria',
  4: 'Lost Tower',
  6: 'Arena',
  7: 'Atlans',
  8: 'Tarkan',
  10: 'Icarus',
};

const COLOR_BLOCKED = [14, 12, 9, 235];
const COLOR_GROUND = [96, 84, 62, 235];
const COLOR_SAFE = [70, 110, 92, 235];

/** Imagem 256x256 do mapa atual: um pixel por quadrado. */
function buildTerrainImage(world: World): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = MAP_SIZE;
  canvas.height = MAP_SIZE;
  const ctx = canvas.getContext('2d')!;
  const image = ctx.createImageData(MAP_SIZE, MAP_SIZE);
  for (let z = 0; z < MAP_SIZE; z++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      const color = !world.isWalkable(x, z)
        ? COLOR_BLOCKED
        : (world.getTerrainFlag(x, z) & TWFlags.SafeZone) !== 0
          ? COLOR_SAFE
          : COLOR_GROUND;
      image.data.set(color, (z * MAP_SIZE + x) * 4);
    }
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

type Mode = 'small' | 'large';
const SIZES: Record<Mode, { size: number; tilePx: number }> = {
  small: { size: 168, tilePx: 2.4 },
  large: { size: 420, tilePx: 3.2 },
};

export const MiniMap = observer(() => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const terrainRef = useRef<{ map: number; image: HTMLCanvasElement } | null>(null);
  const [mode, setMode] = useState<Mode>('small');
  const [hidden, setHidden] = useState(false);

  // Tab: pequeno → grande → escondido → pequeno. Sem deixar o Tab mudar o foco da página.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Tab') return;
      e.preventDefault();
      if (hidden) {
        setHidden(false);
        setMode('small');
      } else if (mode === 'small') {
        setMode('large');
      } else {
        setHidden(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mode, hidden]);

  // Refaz a imagem do terreno quando o mapa termina de carregar.
  useEffect(() => {
    const invalidate = () => (terrainRef.current = null);
    EventBus.on('warpCompleted', invalidate);
    return () => EventBus.off('warpCompleted', invalidate);
  }, []);

  useEffect(() => {
    if (hidden) return;
    const { size, tilePx } = SIZES[mode];

    const draw = () => {
      const canvas = canvasRef.current;
      const world = Store.world;
      const player = world?.playerEntity;
      if (!canvas || !world || !player || Store.mapLoading) return;
      const ctx = canvas.getContext('2d')!;

      if (!terrainRef.current || terrainRef.current.map !== world.mapIndex) {
        terrainRef.current = { map: world.mapIndex, image: buildTerrainImage(world) };
      }

      // Direções da câmera no chão: "frente" (para cima na tela) e "direita".
      const camera = world.scene.activeCamera as { alpha?: number } | null;
      const alpha = camera?.alpha ?? -Math.PI / 4;
      const fx = -Math.cos(alpha);
      const fz = -Math.sin(alpha);
      const rx = fz;
      const rz = -fx;

      const px = player.transform.pos.x;
      const pz = player.transform.pos.z;
      const c = size / 2;
      const toScreen = (x: number, z: number): [number, number] => {
        const dx = x - px;
        const dz = z - pz;
        return [c + tilePx * (rx * dx + rz * dz), c - tilePx * (fx * dx + fz * dz)];
      };

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.beginPath();
      ctx.arc(c, c, c - 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = 'rgba(8, 7, 5, 0.85)';
      ctx.fillRect(0, 0, size, size);

      // Terreno: transforma (quadrado x, z) → tela, com o jogador no centro.
      const a = tilePx * rx;
      const cc = tilePx * rz;
      const b = -tilePx * fx;
      const d = -tilePx * fz;
      ctx.setTransform(a, b, cc, d, c - (a * px + cc * pz), c - (b * px + d * pz));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(terrainRef.current.image, 0, 0);
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Quem está em volta.
      for (const e of world.netObjsQuery.entities) {
        if (e === player || e.objOutOfScope || e.dead) continue;
        let color: string | null = null;
        let radius = 2.2;
        if (e.npcType !== undefined) {
          const kind = MONSTER_MODELS[e.npcType]?.[1];
          if (kind === 'monster') color = '#ff4a3d';
          else if (kind === 'npc') {
            color = '#ffd75e';
            radius = 2.8;
          }
        } else if (e.playerAnimation) {
          color = '#5fb0ff';
          radius = 2.8;
        }
        if (!color) continue;
        const [sx, sy] = toScreen(e.transform.pos.x, e.transform.pos.z);
        if (Math.hypot(sx - c, sy - c) > c - 4) continue;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Você, no centro.
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(c, c, 3.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    draw();
    const timer = window.setInterval(draw, 120);
    return () => window.clearInterval(timer);
  }, [mode, hidden]);

  if (hidden) return null;

  const { size } = SIZES[mode];
  const mapName = MAP_NAMES[Store.world?.mapIndex ?? -1] ?? '';

  return (
    <div className={`mini-map ${mode}`} title="Minimapa (Tab muda o tamanho)">
      <canvas ref={canvasRef} width={size} height={size} style={{ width: size, height: size }} />
      <div className="mini-map-label">
        <span className="map-name">{mapName}</span>
        <span className="coords">
          {Store.playerData.x}, {Store.playerData.y}
        </span>
      </div>
    </div>
  );
});
