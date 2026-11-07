import './style.less';
import { observer } from 'mobx-react-lite';
import { runInAction } from 'mobx';
import { useState } from 'react';
import { Store } from '../../../../../store';
import { ItemIcon } from '../../../../components/itemIcon';
import { useEventBus } from '../../../../../hooks/useEventBus';
import { Item } from '../../../../../ecs/world';
import { ItemsDatabase } from '../../../../../common/itemsDatabase';
import { InventoryConstants as IC } from '../../../../../common/inventoryConstants';
import {
  BAG_COLUMNS,
  BAG_ROWS,
  FIRST_BAG_SLOT,
  bagPosition,
  fitsInBag,
  itemSize,
} from '../../../../../common/inventoryLayout';

// thegame: inventário interativo, no estilo do MU.
// Clique esquerdo: pega o item (fica destacado) / solta no slot clicado.
// Clique direito: equipa (mochila) ou desequipa (equipamento). Esc cancela.

const isEquipmentSlot = (slot: number) => slot < FIRST_BAG_SLOT;

function onSlotClick(slot: number) {
  const items = Store.playerData.items;
  const held = Store.heldItemSlot;

  if (held === null) {
    if (items[slot]) runInAction(() => (Store.heldItemSlot = slot));
    return;
  }

  runInAction(() => (Store.heldItemSlot = null));
  if (held === slot) return;

  const item = items[held];
  if (!item) return;

  if (!isEquipmentSlot(slot) && !fitsInBag(item, slot, items, held)) {
    Store.addChatMessage('system', 'O item não cabe nesse lugar.');
    return;
  }
  Store.sendItemMove(held, slot);
}

function onSlotRightClick(slot: number) {
  runInAction(() => (Store.heldItemSlot = null));
  if (!Store.playerData.items[slot]) return;
  if (isEquipmentSlot(slot)) Store.unequipItem(slot);
  else Store.equipItem(slot);
}

const slotHandlers = (slot: number) => ({
  onClick: (e: React.MouseEvent) => {
    e.stopPropagation();
    onSlotClick(slot);
  },
  onContextMenu: (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSlotRightClick(slot);
  },
});

const ItemTooltip = ({ item, children }: { item: Item | null; children: React.ReactNode }) => {
  const config = item ? ItemsDatabase.getItem(item.group, item.num) : null;
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div
      className="tooltip"
      onPointerEnter={() => setIsVisible(true)}
      onPointerLeave={() => setIsVisible(false)}
    >
      {children}
      {!!config && isVisible && (
        <div className="tooltip-content" style={{ left: 0, top: 0 }}>
          <div className="tooltip-content-name">
            {config.ItemName}
            {item?.lvl ? ` +${item.lvl}` : ''}
          </div>
          <div className="tooltip-content-hint">Clique: mover · Botão direito: equipar/desequipar</div>
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
    if (key === 'Escape') {
      runInAction(() => (Store.heldItemSlot = null));
    }
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
      <div className="inventory-hint">Clique: pegar/soltar · Botão direito: equipar · Esc: cancelar</div>
    </div>
  );
});
