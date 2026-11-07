import type { Item } from '../ecs/world';
import { InventoryConstants } from './inventoryConstants';
import { ItemsDatabase } from './itemsDatabase';

// thegame: regras do inventário do MU (Season 6) usadas pela interface.
// Slots 0–11 = equipamento; 12–75 = mochila 8x8 (slot = 12 + linha * 8 + coluna).

export const FIRST_BAG_SLOT = InventoryConstants.LastEquippableItemSlotIndex + 1; // 12
export const BAG_COLUMNS = InventoryConstants.RowSize; // 8
export const BAG_ROWS = InventoryConstants.InventoryRows; // 8
export const LAST_BAG_SLOT = FIRST_BAG_SLOT + BAG_COLUMNS * BAG_ROWS - 1; // 75

export function itemSize(item: Item): { w: number; h: number } {
  const config = ItemsDatabase.getItem(item.group, item.num);
  // Alguns itens têm X/Y = 0 no items.json do cliente (ex.: 14/110); ocupam pelo menos 1x1.
  return { w: Math.max(1, config?.X || 1), h: Math.max(1, config?.Y || 1) };
}

export function bagPosition(slot: number): { col: number; row: number } {
  const index = slot - FIRST_BAG_SLOT;
  return { col: index % BAG_COLUMNS, row: Math.floor(index / BAG_COLUMNS) };
}

/** Mapa das células ocupadas da mochila (índice 0..63 -> slot do item que ocupa). */
export function bagOccupancy(items: (Item | null | undefined)[], ignoreSlot?: number): (number | null)[] {
  const cells: (number | null)[] = new Array(BAG_COLUMNS * BAG_ROWS).fill(null);
  for (let slot = FIRST_BAG_SLOT; slot <= LAST_BAG_SLOT; slot++) {
    const item = items[slot];
    if (!item || slot === ignoreSlot) continue;
    const { col, row } = bagPosition(slot);
    const { w, h } = itemSize(item);
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        const c = col + dx;
        const r = row + dy;
        if (c < BAG_COLUMNS && r < BAG_ROWS) cells[r * BAG_COLUMNS + c] = slot;
      }
    }
  }
  return cells;
}

/** true se o item cabe com o canto superior esquerdo no slot `slot` da mochila. */
export function fitsInBag(
  item: Item,
  slot: number,
  items: (Item | null | undefined)[],
  ignoreSlot?: number
): boolean {
  if (slot < FIRST_BAG_SLOT || slot > LAST_BAG_SLOT) return false;
  const { col, row } = bagPosition(slot);
  const { w, h } = itemSize(item);
  if (col + w > BAG_COLUMNS || row + h > BAG_ROWS) return false;
  const cells = bagOccupancy(items, ignoreSlot);
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      if (cells[(row + dy) * BAG_COLUMNS + col + dx] !== null) return false;
    }
  }
  return true;
}

export function findFreeInventorySlot(
  item: Item,
  items: (Item | null | undefined)[],
  ignoreSlot?: number
): number | null {
  for (let slot = FIRST_BAG_SLOT; slot <= LAST_BAG_SLOT; slot++) {
    if (fitsInBag(item, slot, items, ignoreSlot)) return slot;
  }
  return null;
}

/**
 * Slot de equipamento para o item (campo ItemSlot do items.json). Anéis usam o
 * segundo anel se o primeiro estiver ocupado; armas, a outra mão.
 */
export function getEquipmentSlotFor(item: Item, items: (Item | null | undefined)[]): number | null {
  const config = ItemsDatabase.getItem(item.group, item.num);
  const slot = config?.ItemSlot;
  if (slot === undefined || slot === null || slot < 0 || slot > 11) return null;

  if (slot === InventoryConstants.Ring1Slot || slot === InventoryConstants.Ring2Slot) {
    return items[InventoryConstants.Ring1Slot] ? InventoryConstants.Ring2Slot : InventoryConstants.Ring1Slot;
  }
  if (slot === InventoryConstants.LeftHandSlot && items[InventoryConstants.LeftHandSlot]) {
    return items[InventoryConstants.RightHandSlot] ? InventoryConstants.LeftHandSlot : InventoryConstants.RightHandSlot;
  }
  return slot;
}
