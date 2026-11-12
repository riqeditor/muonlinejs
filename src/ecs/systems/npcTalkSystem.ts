import { tileDistance } from '../../common/direction';
import { Store } from '../../store';
import type { ISystemFactory } from '../world';

// thegame: clicar num NPC faz o personagem andar até perto dele e pedir para conversar
// (C3 30 TalkToNpcRequest). O servidor responde com a janela (loja, baú, Chaos Machine…).

/** Distância (em quadrados) para falar com o NPC. O OpenMU aceita até ~5. */
const TALK_RANGE = 3;
const REPATH_INTERVAL = 0.5;

export const NpcTalkSystem: ISystemFactory = world => {
  let repathTimer = 0;

  return {
    update: dt => {
      repathTimer -= dt;

      const player = world.playerEntity;
      const targetId = world.talkTargetNetId;
      if (!player || targetId === null) return;

      const npc = world.netObjsQuery.entities.find(e => e.netId === targetId && !e.objOutOfScope);
      if (!npc || Store.playerDead) {
        world.talkTargetNetId = null;
        return;
      }

      const nx = npc.transform.pos.x;
      const nz = npc.transform.pos.z;

      if (tileDistance(player.transform.pos.x, player.transform.pos.z, nx, nz) <= TALK_RANGE) {
        if (player.pathfinding.path && player.pathfinding.path.length > 0) player.pathfinding.path = [];
        Store.talkToNpc(targetId);
        world.talkTargetNetId = null;
        return;
      }

      if (repathTimer <= 0) {
        repathTimer = REPATH_INTERVAL;
        // Anda até um quadrado andável ao lado do NPC (o quadrado dele é ocupado).
        const px = player.transform.pos.x;
        const pz = player.transform.pos.z;
        let best: [number, number] | null = null;
        let bestDist = Infinity;
        for (let dx = -2; dx <= 2; dx++) {
          for (let dz = -2; dz <= 2; dz++) {
            if (dx === 0 && dz === 0) continue;
            const x = Math.floor(nx) + dx;
            const z = Math.floor(nz) + dz;
            if (!world.isWalkable(x, z)) continue;
            const d = Math.hypot(x - px, z - pz);
            if (d < bestDist) {
              bestDist = d;
              best = [x, z];
            }
          }
        }
        if (!best) {
          world.talkTargetNetId = null;
          return;
        }
        player.playerMoveTo.point.x = best[0] + 0.5;
        player.playerMoveTo.point.y = best[1] + 0.5;
        player.playerMoveTo.handled = false;
        player.playerMoveTo.sendToServer = true;
      }
    },
  };
};
