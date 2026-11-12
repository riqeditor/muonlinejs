import './style.less';
import { observer } from 'mobx-react-lite';
import { runInAction } from 'mobx';
import { Store } from '../../../../../store';
import { useEventBus } from '../../../../../hooks/useEventBus';

// thegame: ficha do personagem (tecla C) com os dados reais do servidor e distribuição de
// pontos. Clique = +1, Shift+clique = +10, Ctrl+clique = +100 (limitado aos pontos livres).
// Cada ponto é um C1 F3 06 IncreaseCharacterStatPoint; o servidor confirma um por um.

const HOT_KEY = 'KeyC';

/** Número do atributo no protocolo (OpenMU CharacterStatAttribute). */
const STATS = [
  { attr: 0, label: 'Força', key: 'str' },
  { attr: 1, label: 'Agilidade', key: 'agi' },
  { attr: 2, label: 'Vitalidade', key: 'sta' },
  { attr: 3, label: 'Energia', key: 'eng' },
] as const;

function amountFor(e: React.MouseEvent): number {
  if (e.ctrlKey) return 100;
  if (e.shiftKey) return 10;
  return 1;
}

export const CharacterInfo = observer(() => {
  const playerData = Store.playerData;

  useEventBus('keyPressed', key => {
    if (key === HOT_KEY) {
      runInAction(() => (Store.characterInfoEnabled = !Store.characterInfoEnabled));
    }
  });

  if (!Store.characterInfoEnabled) {
    return null;
  }

  const free = playerData.points;
  const expInLevel = Math.max(0, playerData.exp - playerData.currentLvlExp);
  const expNeeded = Math.max(1, playerData.expToNextLvl - playerData.currentLvlExp);

  return (
    <div className="character-info" onPointerDown={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}>
      <span className="nickname">{Store.characterName}</span>
      <span className="status">{Store.characterClassName}</span>

      <div className="info-rows">
        <div className="row">
          <span>Nível</span>
          <b>{playerData.level}</b>
        </div>
        <div className="row">
          <span>Experiência</span>
          <b>
            {expInLevel.toLocaleString('pt-BR')} / {expNeeded.toLocaleString('pt-BR')}
          </b>
        </div>
        <div className={`row points${free > 0 ? ' has-points' : ''}`}>
          <span>Pontos livres</span>
          <b>{free.toLocaleString('pt-BR')}</b>
        </div>
      </div>

      <div className="stats">
        {STATS.map(stat => (
          <div className="stat" key={stat.attr}>
            <span className="label">{stat.label}</span>
            <span className="value">{playerData[stat.key].toLocaleString('pt-BR')}</span>
            <button
              className="add-point"
              disabled={free <= 0}
              title="Clique: +1 · Shift+clique: +10 · Ctrl+clique: +100"
              onClick={e => {
                e.stopPropagation();
                Store.increaseStat(stat.attr, amountFor(e));
              }}
            >
              +
            </button>
          </div>
        ))}
      </div>

      <div className="info-rows">
        <div className="row">
          <span>Vida</span>
          <b>
            {playerData.currentHP} / {playerData.maxHP}
          </b>
        </div>
        <div className="row">
          <span>Mana</span>
          <b>
            {playerData.currentMP} / {playerData.maxMP}
          </b>
        </div>
        <div className="row">
          <span>Zen</span>
          <b>{playerData.money.toLocaleString('pt-BR')}</b>
        </div>
      </div>

      <span className="hint">Clique no + para usar 1 ponto · Shift: 10 · Ctrl: 100</span>
    </div>
  );
});
