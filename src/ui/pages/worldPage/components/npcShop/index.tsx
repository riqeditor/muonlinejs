import './style.less';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Store } from '../../../../../store';
import { ItemIcon } from '../../../../components/itemIcon';
import { findFreeInventorySlot, itemSize } from '../../../../../common/inventoryLayout';
import { ItemTooltip } from '../inventory';

// thegame: janela de NPC com grade de itens (8 colunas, posição = linha * 8 + coluna):
// - Loja (NpcWindow 0/1): itens do C2 31; botão direito compra; na mochila, vende.
//   "Consertar tudo" manda C1 34 com slot 0xFF.
// - Baú (NpcWindow 2): itens do baú (também C2 31); botão direito traz para a mochila;
//   na mochila, guarda no baú. Zen: C1 81 (guardar/sacar).

const COLUMNS = 8;
const ROWS = 15;

const VaultMoney = observer(() => {
  const [amount, setAmount] = useState('');
  const value = Number(amount.replace(/\D/g, '')) || 0;
  return (
    <div className="vault-money">
      <div className="row">
        <span>Zen no baú</span>
        <b>{Store.vaultMoney.toLocaleString('pt-BR')}</b>
      </div>
      <div className="row">
        <input
          type="text"
          inputMode="numeric"
          placeholder="quantidade"
          value={amount ? value.toLocaleString('pt-BR') : ''}
          onChange={e => setAmount(e.target.value)}
        />
        <button className="mu-button small" disabled={!value} onClick={() => Store.moveVaultMoney(0, value)}>
          Guardar
        </button>
        <button className="mu-button small" disabled={!value} onClick={() => Store.moveVaultMoney(1, value)}>
          Sacar
        </button>
      </div>
    </div>
  );
});

export const NpcShop = observer(() => {
  const isShop = Store.npcWindow === 0 || Store.npcWindow === 1;
  const isVault = Store.npcWindow === 2;
  if (!isShop && !isVault) return null;

  const items = Store.shopItems;

  const onItemAction = (slot: number) => {
    if (isShop) {
      Store.buyFromNpc(slot);
      return;
    }
    const item = items[slot];
    if (!item) return;
    const target = findFreeInventorySlot(item, Store.playerData.items);
    if (target === null) Store.addChatMessage('system', 'Não há espaço livre no inventário.');
    else Store.moveBetweenStorages(2, slot, 0, target);
  };

  const cells = [];
  const placed = [];
  for (let slot = 0; slot < COLUMNS * ROWS; slot++) {
    const col = slot % COLUMNS;
    const row = Math.floor(slot / COLUMNS);
    cells.push(<div key={`c${slot}`} className="shop-cell" style={{ gridColumn: col + 1, gridRow: row + 1 }} />);
    const item = items[slot];
    if (!item) continue;
    const { w, h } = itemSize(item);
    placed.push(
      <div
        key={`i${slot}`}
        className="shop-item"
        style={{ gridColumn: `${col + 1} / span ${w}`, gridRow: `${row + 1} / span ${h}` }}
        onContextMenu={e => {
          e.preventDefault();
          e.stopPropagation();
          onItemAction(slot);
        }}
        onDoubleClick={e => {
          e.stopPropagation();
          onItemAction(slot);
        }}
      >
        <ItemTooltip item={item}>
          <ItemIcon {...item} />
        </ItemTooltip>
      </div>
    );
  }

  // A loja mostra só as linhas usadas (+2); o baú mostra a grade inteira.
  const lastRow = items.reduce((max, item, slot) => (item ? Math.max(max, Math.floor(slot / COLUMNS)) : max), 0);
  const rowsShown = isVault ? ROWS : Math.max(6, Math.min(ROWS, lastRow + 3));

  return (
    <div className="npc-shop inventory" onPointerDown={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}>
      <span className="title">{isVault ? 'Baú' : 'Loja'}</span>
      <div className="shop-grid" style={{ gridTemplateRows: `repeat(${rowsShown}, ${isVault ? 26 : 32}px)` }}>
        {cells.slice(0, rowsShown * COLUMNS)}
        {placed}
      </div>
      {isVault && <VaultMoney />}
      <div className="shop-buttons">
        {isShop && (
          <button className="mu-button small" onClick={() => Store.repairItem(0xff)} title="Conserta tudo o que está equipado e na mochila">
            Consertar tudo
          </button>
        )}
        <button className="mu-button small" onClick={() => Store.closeNpc()}>
          Fechar (Esc)
        </button>
      </div>
      <div className="inventory-hint">
        {isVault
          ? 'Botão direito: trazer para a mochila · na mochila: guardar no baú'
          : 'Botão direito ou duplo clique: comprar · na mochila: vender'}
      </div>
    </div>
  );
});
