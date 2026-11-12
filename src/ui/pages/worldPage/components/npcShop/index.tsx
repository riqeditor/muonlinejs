import './style.less';
import { observer } from 'mobx-react-lite';
import { Store } from '../../../../../store';
import { ItemIcon } from '../../../../components/itemIcon';
import { itemSize } from '../../../../../common/inventoryLayout';
import { ItemTooltip } from '../inventory';

// thegame: loja de NPC (janela 0/1 do OpenMU). Itens vêm do C2 31 StoreItemList, numa grade
// de 8 colunas (posição = linha * 8 + coluna). Botão direito compra; com a loja aberta,
// botão direito na mochila vende. "Consertar tudo" manda C1 34 com slot 0xFF.

const COLUMNS = 8;
const ROWS = 15;

export const NpcShop = observer(() => {
  const open = Store.npcWindow === 0 || Store.npcWindow === 1;
  if (!open) return null;

  const items = Store.shopItems;
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
        title=""
        onContextMenu={e => {
          e.preventDefault();
          e.stopPropagation();
          Store.buyFromNpc(slot);
        }}
        onDoubleClick={e => {
          e.stopPropagation();
          Store.buyFromNpc(slot);
        }}
      >
        <ItemTooltip item={item}>
          <ItemIcon {...item} />
        </ItemTooltip>
      </div>
    );
  }

  const lastRow = items.reduce((max, item, slot) => (item ? Math.max(max, Math.floor(slot / COLUMNS)) : max), 0);
  const rowsShown = Math.max(6, Math.min(ROWS, lastRow + 3));

  return (
    <div className="npc-shop inventory" onPointerDown={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}>
      <span className="title">Loja</span>
      <div className="shop-grid" style={{ gridTemplateRows: `repeat(${rowsShown}, 32px)` }}>
        {cells.slice(0, rowsShown * COLUMNS)}
        {placed}
      </div>
      <div className="shop-buttons">
        <button className="mu-button small" onClick={() => Store.repairItem(0xff)} title="Conserta tudo o que está equipado e na mochila">
          Consertar tudo
        </button>
        <button className="mu-button small" onClick={() => Store.closeNpc()}>
          Fechar (Esc)
        </button>
      </div>
      <div className="inventory-hint">Botão direito ou duplo clique: comprar · na mochila: vender</div>
    </div>
  );
});
