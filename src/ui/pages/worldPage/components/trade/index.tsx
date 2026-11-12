import './style.less';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Store } from '../../../../../store';
import { ItemIcon } from '../../../../components/itemIcon';
import { findFreeInventorySlot, itemSize } from '../../../../../common/inventoryLayout';
import { ItemTooltip } from '../inventory';
import type { Item } from '../../../../../ecs/world';

// thegame: troca entre jogadores. Em cima o que o outro oferece, embaixo o que você oferece
// (grade 8x4 cada). Botão direito na mochila coloca o item; botão direito no seu item tira.
// Os dois marcam "Aceitar"; se algo mudar, o servidor desmarca (estado vermelho).

const COLUMNS = 8;
const ROWS = 4;

const TradeGrid = observer(({ items, mine }: { items: (Item | null)[]; mine: boolean }) => {
  const cells = [];
  const placed = [];
  for (let slot = 0; slot < COLUMNS * ROWS; slot++) {
    const col = slot % COLUMNS;
    const row = Math.floor(slot / COLUMNS);
    cells.push(<div key={`c${slot}`} className="trade-cell" style={{ gridColumn: col + 1, gridRow: row + 1 }} />);
    const item = items[slot];
    if (!item) continue;
    const { w, h } = itemSize(item);
    placed.push(
      <div
        key={`i${slot}`}
        className={`trade-item${mine ? ' mine' : ''}`}
        style={{ gridColumn: `${col + 1} / span ${w}`, gridRow: `${row + 1} / span ${h}` }}
        onContextMenu={e => {
          e.preventDefault();
          e.stopPropagation();
          if (!mine) return;
          const target = findFreeInventorySlot(item, Store.playerData.items);
          if (target === null) Store.addChatMessage('system', 'Não há espaço livre no inventário.');
          else Store.moveBetweenStorages(1, slot, 0, target);
        }}
      >
        <ItemTooltip item={item}>
          <ItemIcon {...item} />
        </ItemTooltip>
      </div>
    );
  }
  return (
    <div className="trade-grid">
      {cells}
      {placed}
    </div>
  );
});

const stateLabel = (state: number) => (state === 1 ? 'Aceitou' : state === 2 ? 'Mudou algo' : 'Ainda não aceitou');

export const TradeRequestPopup = observer(() => {
  const from = Store.tradeRequestFrom;
  if (!from) return null;
  return (
    <div className="trade-request mu-window" onPointerDown={e => e.stopPropagation()}>
      <span>
        <b>{from}</b> quer trocar com você.
      </span>
      <div className="buttons">
        <button className="mu-button small" onClick={() => Store.answerTradeRequest(true)}>
          Aceitar
        </button>
        <button className="mu-button small" onClick={() => Store.answerTradeRequest(false)}>
          Recusar
        </button>
      </div>
    </div>
  );
});

export const TradeWindow = observer(() => {
  const [money, setMoney] = useState('');
  const trade = Store.trade;
  if (!trade) return null;
  const moneyValue = Number(money.replace(/\D/g, '')) || 0;

  return (
    <div className="trade-window inventory" onPointerDown={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}>
      <span className="title">Troca</span>

      <div className={`side state-${Store.tradeTheirState}`}>
        <div className="side-head">
          <span>
            {trade.partner} <small>(nível {trade.partnerLevel})</small>
          </span>
          <span className="state">{stateLabel(Store.tradeTheirState)}</span>
        </div>
        <TradeGrid items={Store.tradeTheirItems} mine={false} />
        <div className="money">Zen oferecido: {Store.tradeTheirMoney.toLocaleString('pt-BR')}</div>
      </div>

      <div className={`side state-${Store.tradeMyState}`}>
        <div className="side-head">
          <span>Você</span>
          <span className="state">{stateLabel(Store.tradeMyState)}</span>
        </div>
        <TradeGrid items={Store.tradeMyItems} mine={true} />
        <div className="money-input">
          <input
            type="text"
            inputMode="numeric"
            placeholder="zen"
            value={money ? moneyValue.toLocaleString('pt-BR') : ''}
            onChange={e => setMoney(e.target.value)}
          />
          <button className="mu-button small" onClick={() => Store.setTradeMoney(moneyValue)}>
            Oferecer zen
          </button>
          <span className="offered">{Store.tradeMyMoney.toLocaleString('pt-BR')}</span>
        </div>
      </div>

      <div className="trade-buttons">
        <button
          className={`mu-button small${Store.tradeMyState === 1 ? ' active' : ''}`}
          onClick={() => Store.setTradeAccepted(Store.tradeMyState !== 1)}
        >
          {Store.tradeMyState === 1 ? 'Desmarcar' : 'Aceitar troca'}
        </button>
        <button className="mu-button small" onClick={() => Store.cancelTrade()}>
          Cancelar
        </button>
      </div>
      <div className="inventory-hint">Botão direito na mochila: colocar · no seu item: tirar</div>
    </div>
  );
});

export const Trade = observer(() => (
  <>
    <TradeRequestPopup />
    <TradeWindow />
  </>
));
