import './style.less';
import { observer } from 'mobx-react-lite';
import { runInAction } from 'mobx';
import { useEffect, useState } from 'react';
import { Store } from '../../../../../store';
import { ItemIcon } from '../../../../components/itemIcon';
import { useEventBus } from '../../../../../hooks/useEventBus';
import { Item } from '../../../../../ecs/world';
import { describeItem } from '../../../../../common/itemDescription';
import { InventoryConstants as IC } from '../../../../../common/inventoryConstants';
import {
  BAG_COLUMNS,
  BAG_ROWS,
  FIRST_BAG_SLOT,
  bagPosition,
  findFreeGridSlot,
  fitsInBag,
  itemSize,
} from '../../../../../common/inventoryLayout';

// thegame: inventário interativo, no estilo do MU.
// Clique esquerdo: pega o item (fica destacado) / solta no slot clicado.
// Clique direito: equipa (mochila) ou desequipa (equipamento). Esc cancela.

const isEquipmentSlot = (slot: number) => slot < FIRST_BAG_SLOT;
const isMerchantOpen = () => Store.npcWindow === 0 || Store.npcWindow === 1;

/** Coloca o item "na mão" no slot `slot` (equipamento ou mochila). */
function placeHeldItem(slot: number) {
  const items = Store.playerData.items;
  const held = Store.heldItemSlot;
  runInAction(() => {
    Store.heldItemSlot = null;
    Store.heldItemDragging = false;
  });
  if (held === null || held === slot) return;

  const item = items[held];
  if (!item) return;

  if (!isEquipmentSlot(slot) && !fitsInBag(item, slot, items, held)) {
    Store.addChatMessage('system', 'O item não cabe nesse lugar.');
    return;
  }
  Store.sendItemMove(held, slot);
}

// Botão pressionado: pega o item (começa a arrastar) ou, se já tem um item na mão, solta aqui.
function onSlotPointerDown(slot: number, e: React.PointerEvent) {
  if (e.button !== 0) return;
  e.stopPropagation();
  if (Store.heldItemSlot === null) {
    if (Store.playerData.items[slot]) {
      runInAction(() => {
        Store.heldItemSlot = slot;
        Store.heldItemDragging = true;
      });
    }
    return;
  }
  if (!Store.heldItemDragging) placeHeldItem(slot);
}

// Botão solto: se estava arrastando para outro slot, solta lá; no mesmo slot, o item fica "na mão".
function onSlotPointerUp(slot: number, e: React.PointerEvent) {
  if (e.button !== 0) return;
  e.stopPropagation();
  if (!Store.heldItemDragging || Store.heldItemSlot === null) return;
  if (slot === Store.heldItemSlot) {
    runInAction(() => (Store.heldItemDragging = false));
    return;
  }
  placeHeldItem(slot);
}

function onSlotRightClick(slot: number) {
  runInAction(() => {
    Store.heldItemSlot = null;
    Store.heldItemDragging = false;
  });
  if (!Store.playerData.items[slot]) return;
  // thegame: com a loja de um NPC aberta, clique direito na mochila vende o item.
  if (isMerchantOpen() && !isEquipmentSlot(slot)) {
    Store.sellToNpc(slot);
    return;
  }
  // thegame: com a troca aberta, botão direito na mochila coloca o item na troca (8x4).
  if (Store.trade && !isEquipmentSlot(slot)) {
    const item = Store.playerData.items[slot];
    const target = findFreeGridSlot(item, Store.tradeMyItems, 8, 4);
    if (target === null) Store.addChatMessage('system', 'Não cabe mais nada na troca.');
    else Store.moveBetweenStorages(0, slot, 1, target);
    return;
  }
  // thegame: com o baú aberto, botão direito na mochila guarda o item no baú.
  if (Store.npcWindow === 2 && !isEquipmentSlot(slot)) {
    const item = Store.playerData.items[slot];
    const target = findFreeGridSlot(item, Store.shopItems);
    if (target === null) Store.addChatMessage('system', 'O baú está cheio.');
    else Store.moveBetweenStorages(0, slot, 2, target);
    return;
  }
  if (isEquipmentSlot(slot)) Store.unequipItem(slot);
  else Store.equipItem(slot);
}

const slotHandlers = (slot: number) => ({
  onPointerDown: (e: React.PointerEvent) => onSlotPointerDown(slot, e),
  onPointerUp: (e: React.PointerEvent) => onSlotPointerUp(slot, e),
  onContextMenu: (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSlotRightClick(slot);
  },
});

/** Ícone do item "na mão" seguindo o cursor, como no MU. */
const HeldItemCursor = observer(() => {
  const [pos, setPos] = useState({ x: -1000, y: -1000 });
  useEffect(() => {
    const onMove = (e: PointerEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  const slot = Store.heldItemSlot;
  const item = slot !== null ? Store.playerData.items[slot] : null;
  if (!item) return null;

  return (
    <div className="held-item-cursor" style={{ left: pos.x, top: pos.y }}>
      <ItemIcon {...item} />
    </div>
  );
});

export const ItemTooltip = ({ item, children }: { item: Item | null; children: React.ReactNode }) => {
  const [isVisible, setIsVisible] = useState(false);
  const lines = item && isVisible ? describeItem(item) : [];

  return (
    <div
      className="tooltip"
      onPointerEnter={() => setIsVisible(true)}
      onPointerLeave={() => setIsVisible(false)}
    >
      {children}
      {lines.length > 0 && Store.heldItemSlot === null && (
        <div className="tooltip-content item-description">
          {lines.map((line, i) => (
            <div key={i} className={i === 0 ? 'item-name' : 'item-line'} style={{ color: line.color }}>
              {line.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const EquipmentItem = observer(({ className, slot }: { className: string; slot: number }) => {
  const item = Store.playerData.items[slot] ?? null;
  const held = Store.heldItemSlot === slot;

  return (
    <div className={`equipment-item ${className}${held ? ' held' : ''}`} {...slotHandlers(slot)}>
      <span className="equipment-item-name">
        {!!item && (
          <ItemTooltip item={item}>
            <ItemIcon {...item} />
          </ItemTooltip>
        )}
      </span>
    </div>
  );
});

const BagGrid = observer(() => {
  const items = Store.playerData.items;
  const cells = [];
  const placed = [];

  for (let i = 0; i < BAG_COLUMNS * BAG_ROWS; i++) {
    const slot = FIRST_BAG_SLOT + i;
    const { col, row } = bagPosition(slot);
    cells.push(
      <div
        key={`cell-${slot}`}
        className="bag-cell"
        style={{ gridColumn: col + 1, gridRow: row + 1 }}
        {...slotHandlers(slot)}
      />
    );

    const item = items[slot];
    if (item) {
      const { w, h } = itemSize(item);
      placed.push(
        <div
          key={`item-${slot}`}
          className={`inventory-item used${Store.heldItemSlot === slot ? ' held' : ''}`}
          style={{ gridColumn: `${col + 1} / span ${w}`, gridRow: `${row + 1} / span ${h}` }}
          {...slotHandlers(slot)}
        >
          <div className="bg">
            <ItemTooltip item={item}>
              <ItemIcon {...item} />
            </ItemTooltip>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="inventory-items">
      {cells}
      {placed}
    </div>
  );
});

const HOT_KEYS = ['KeyI', 'KeyV'];

export const Inventory = observer(() => {
  const playerData = Store.playerData;

  useEventBus('keyPressed', key => {
    if (HOT_KEYS.includes(key)) {
      runInAction(() => {
        Store.inventoryEnabled = !Store.inventoryEnabled;
        Store.heldItemSlot = null;
      });
    }
    // Escape é tratado no menu do Esc (escMenu): cancela o item na mão / fecha o inventário.
  });

  if (!Store.inventoryEnabled) {
    return null;
  }

  return (
    <div className="inventory" onContextMenu={e => e.preventDefault()}>
      <span className="title">Inventário</span>
      <div className="equipment">
        <EquipmentItem className="pet" slot={IC.PetSlot} />
        <EquipmentItem className="leftHand" slot={IC.LeftHandSlot} />
        <EquipmentItem className="rightHand" slot={IC.RightHandSlot} />
        <EquipmentItem className="helmet" slot={IC.HelmSlot} />
        <EquipmentItem className="armor" slot={IC.ArmorSlot} />
        <EquipmentItem className="gloves" slot={IC.GlovesSlot} />
        <EquipmentItem className="boots" slot={IC.BootsSlot} />
        <EquipmentItem className="pants" slot={IC.PantsSlot} />
        <EquipmentItem className="leftRing" slot={IC.Ring1Slot} />
        <EquipmentItem className="rightRing" slot={IC.Ring2Slot} />
        <EquipmentItem className="amulet" slot={IC.PendantSlot} />
        <EquipmentItem className="wings" slot={IC.WingsSlot} />
      </div>
      <BagGrid />
      <div className="zen">Zen: {playerData.money.toLocaleString('pt-BR')}</div>
      <div className="inventory-hint">
        {Store.trade
          ? 'Troca aberta: botão direito na mochila coloca o item na troca'
          : Store.npcWindow === 2
          ? 'Baú aberto: botão direito na mochila guarda o item'
          : isMerchantOpen()
          ? 'Loja aberta: botão direito na mochila vende o item'
          : 'Arraste ou clique para mover · solte no chão para jogar fora · botão direito: equipar · Esc: cancelar'}
      </div>
      <HeldItemCursor />
    </div>
  );
});
