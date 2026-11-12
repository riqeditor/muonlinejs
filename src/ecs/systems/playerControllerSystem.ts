import {
  CreateBox,
  PointerEventTypes,
  StandardMaterial,
} from '../../libs/babylon/exports';
import type { ISystemFactory } from '../world';
import { Store } from '../../store';
import { runInAction } from 'mobx';
import { isAttackable, isTalkableNpc } from './combatSystem';
import { CLICK_PICKUP_RADIUS, findGroundItemNear } from './pickupSystem';

const MOVE_DELAY = 0.25;
/**
 * thegame: até quantos quadrados do personagem dá para jogar um item no chão. O OpenMU não
 * limita a distância (só exige quadrado andável); 15 cobre a tela inteira.
 */
const DROP_RANGE = 15;

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

    // thegame: botão direito usa a habilidade selecionada na barra (como no MU).
    if (
      ev.type === PointerEventTypes.POINTERDOWN &&
      (ev.event as PointerEvent).button === 2
    ) {
      castSelectedSkill();
    }
  });

  // thegame: soltar o arraste de um item do inventário em cima do mapa = jogar no chão.
  // O Babylon ignora o "soltar" quando o "apertar" começou fora do canvas (no painel),
  // por isso a escuta é na janela, conferindo se o cursor está sobre o canvas.
  const canvas = scene.getEngine().getRenderingCanvas();
  window.addEventListener('pointerup', ev => {
    if (ev.button !== 0 || Store.heldItemSlot === null || !Store.heldItemDragging) return;
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    if (under !== canvas) return;
    lastClientX = ev.clientX;
    lastClientY = ev.clientY;
    pendingClick = false;
    dropHeldItemOnGround();
  });

  // O menu do navegador no botão direito atrapalha o jogo.
  scene.getEngine().getRenderingCanvas()?.addEventListener('contextmenu', e => e.preventDefault());

  /** Joga o item "na mão" no chão onde está o cursor (ou aos pés do personagem, se ali não for andável). */
  function dropHeldItemOnGround() {
    const player = world.playerEntity;
    const slot = Store.heldItemSlot;
    runInAction(() => {
      Store.heldItemSlot = null;
      Store.heldItemDragging = false;
    });
    if (!player || slot === null) return;

    const px = Math.floor(player.transform.pos.x);
    const py = Math.floor(player.transform.pos.z);
    let x = px;
    let y = py;
    const pickInfo = scene.pick(lastClientX, lastClientY, m => m === world.terrain?.mesh, true);
    const point = pickInfo?.pickedPoint;
    if (point) {
      const tx = Math.floor(point.x);
      const ty = Math.floor(point.z);
      if (Math.max(Math.abs(tx - px), Math.abs(ty - py)) <= DROP_RANGE && world.isWalkable(tx, ty)) {
        x = tx;
        y = ty;
      }
    }
    Store.sendDropItem(slot, x, y);
  }

  function castSelectedSkill() {
    const player = world.playerEntity;
    if (!player || Store.playerDead) return;

    const skillNumber = Store.selectedSkill;
    if (skillNumber === null) {
      Store.addChatMessage('system', 'Selecione uma habilidade na barra (clique ou teclas 1 a 5).');
      return;
    }

    const target = world.currentPointerTarget;
    if (isAttackable(target)) {
      world.pendingSkill = {
        number: skillNumber,
        targetNetId: target!.netId!,
        x: target!.transform!.pos.x,
        y: target!.transform!.pos.z,
      };
      return;
    }

    const pickInfo = scene.pick(lastClientX, lastClientY, m => m === world.terrain?.mesh, true);
    const point = pickInfo?.pickedPoint;
    world.pendingSkill = {
      number: skillNumber,
      targetNetId: null,
      x: point ? point.x : player.transform.pos.x,
      y: point ? point.z : player.transform.pos.z,
    };
  }

  let delay = MOVE_DELAY;
  function tryMove() {
    const playerEntity = world.playerEntity;
    if (!playerEntity) return;

    // thegame: morto não anda (espera o RespawnAfterDeath).
    if (Store.playerDead) return;

    // thegame: com um item do inventário "na mão", clicar no mapa joga o item no chão.
    if (Store.heldItemSlot !== null) {
      dropHeldItemOnGround();
      return;
    }

    // thegame: clique num monstro = atacar (CombatSystem). Clique no chão cancela o ataque.
    const target = world.currentPointerTarget;
    if (isAttackable(target)) {
      world.attackTargetNetId = target!.netId!;
      world.pickupTargetNetId = null;
      world.talkTargetNetId = null;
      return;
    }
    world.attackTargetNetId = null;

    // thegame: clique num NPC (vendedor, baú, Chaos Goblin…) = andar até ele e conversar.
    if (isTalkableNpc(target)) {
      world.talkTargetNetId = target!.netId!;
      world.pickupTargetNetId = null;
      return;
    }
    world.talkTargetNetId = null;

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

    // thegame: clique em cima (ou ao lado) de um item no chão = pegar o item.
    const item = findGroundItemNear(world, point.x, point.z, CLICK_PICKUP_RADIUS);
    if (item?.netId !== undefined) {
      world.pickupTargetNetId = item.netId;
      return;
    }
    world.pickupTargetNetId = null;

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
