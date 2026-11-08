import './style.less';
import { observer } from 'mobx-react-lite';
import { runInAction } from 'mobx';
import { Store } from '../../../../../store';
import { ItemIcon } from '../../../../components/itemIcon';
import { Item } from '../../../../../ecs/world';
import { useEventBus } from '../../../../../hooks/useEventBus';
import { FIRST_BAG_SLOT } from '../../../../../common/inventoryLayout';
import { SkillBar } from '../skillBar';

// thegame: barra inferior no estilo da 0.97d — orbe de vida (vermelho) à esquerda, orbe de
// mana (azul) à direita, poções Q/W/E/R, habilidades no centro e botões de janela.
// Sem SD e sem AG (não existem na 0.97d).

/** Poções de cada tecla, da mais forte para a mais fraca (grupo 14). */
const POTION_KEYS: { key: string; code: string; label: string; nums: number[] }[] = [
  { key: 'Q', code: 'KeyQ', label: 'Poção de vida', nums: [3, 2, 1, 0] },
  { key: 'W', code: 'KeyW', label: 'Poção de mana', nums: [6, 5, 4] },
  { key: 'E', code: 'KeyE', label: 'Antídoto', nums: [8] },
  { key: 'R', code: 'KeyR', label: 'Pergaminho de teleporte', nums: [10] },
];

const POTION_GROUP = 14;

/** Quantidade de um item empilhável (no MU, a "durabilidade" das poções é a quantidade). */
const stackCount = (item: Item) => Math.max(1, item.durability ?? 1);

function findPotion(nums: number[]): { slot: number; item: Item; total: number } | null {
  const items = Store.playerData.items;
  let best: { slot: number; item: Item } | null = null;
  let total = 0;
  for (const num of nums) {
    for (let slot = FIRST_BAG_SLOT; slot < items.length; slot++) {
      const item = items[slot];
      if (!item || item.group !== POTION_GROUP || item.num !== num) continue;
      total += stackCount(item);
      if (!best) best = { slot, item };
    }
  }
  return best ? { ...best, total } : null;
}

const PotionSlot = observer(({ potion }: { potion: (typeof POTION_KEYS)[number] }) => {
  const found = findPotion(potion.nums);
  const icon: Item = found?.item ?? { group: POTION_GROUP, num: potion.nums[potion.nums.length - 1] };

  return (
    <button
      className={`potion-slot${found ? '' : ' empty'}`}
      title={`${potion.label} (tecla ${potion.key})`}
      onClick={e => {
        e.stopPropagation();
        if (found) Store.consumeItem(found.slot);
      }}
    >
      <span className="hot-key">{potion.key}</span>
      <ItemIcon {...icon} />
      {!!found && <span className="count">{found.total}</span>}
    </button>
  );
});

const Orb = ({ kind, value, max, fill }: { kind: 'hp' | 'mp'; value: number; max: number; fill: number }) => {
  const pct = Math.max(0, Math.min(1, fill || 0)) * 100;
  return (
    <div className={`orb orb-${kind}`} title={kind === 'hp' ? 'Vida' : 'Mana'}>
      <div className="orb-glass">
        <div className="orb-liquid" style={{ height: `${pct}%` }} />
        <div className="orb-shine" />
      </div>
      <span className="orb-value">
        {Math.max(0, value)}/{max}
      </span>
    </div>
  );
};

export const ExpBar = observer(() => {
  const playerData = Store.playerData;
  const pct = Math.max(0, Math.min(1, playerData.expPercent || 0)) * 100;

  return (
    <div className="exp-bar" title={`Experiência: ${playerData.exp.toLocaleString('pt-BR')}`}>
      <div className="fill" style={{ width: `${pct}%` }} />
      <div className="ticks" />
      <span className="value">
        Nível {playerData.level} · {pct.toFixed(1)}%
      </span>
    </div>
  );
});

export const BottomBar = observer(() => {
  const playerData = Store.playerData;

  useEventBus('keyPressed', code => {
    const potion = POTION_KEYS.find(p => p.code === code);
    if (!potion) return;
    const found = findPotion(potion.nums);
    if (found) Store.consumeItem(found.slot);
  });

  return (
    <div className="bottom-bar">
      <ExpBar />
      <div className="bar-frame">
        <Orb kind="hp" value={playerData.currentHP} max={playerData.maxHP} fill={playerData.hpPercent} />

        <div className="bar-center">
          <div className="potions">
            {POTION_KEYS.map(p => (
              <PotionSlot key={p.key} potion={p} />
            ))}
          </div>

          <SkillBar />

          <div className="menu-buttons">
            <button
              title="Personagem (C)"
              className={Store.characterInfoEnabled ? 'active' : ''}
              onClick={e => {
                e.stopPropagation();
                runInAction(() => (Store.characterInfoEnabled = !Store.characterInfoEnabled));
              }}
            >
              C
            </button>
            <button
              title="Inventário (I ou V)"
              className={Store.inventoryEnabled ? 'active' : ''}
              onClick={e => {
                e.stopPropagation();
                runInAction(() => (Store.inventoryEnabled = !Store.inventoryEnabled));
              }}
            >
              I
            </button>
            <button
              title="Menu (Esc)"
              className={Store.escMenuOpen ? 'active' : ''}
              onClick={e => {
                e.stopPropagation();
                runInAction(() => (Store.escMenuOpen = !Store.escMenuOpen));
              }}
            >
              Menu
            </button>
          </div>
        </div>

        <Orb kind="mp" value={playerData.currentMP} max={playerData.maxMP} fill={playerData.mpPercent} />
      </div>
    </div>
  );
});
