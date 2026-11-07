import type { Item } from '../ecs/world';
import { ItemsDatabase } from './itemsDatabase';
import { ITEM_STATS } from './itemStats';

// thegame: descrição do item no estilo do MU (tooltip do inventário).
// Usa o items.json do cliente (valores base) e as opções lidas dos bytes do item.

export type DescriptionLine = { text: string; color: string };

const COLOR_NORMAL = '#e8e8e8';
const COLOR_BLUE = '#7fb2ff';
const COLOR_GOLD = '#ffd75e';
const COLOR_EXCELLENT = '#5dff7a';
const COLOR_ANCIENT = '#45d6c8';
const COLOR_GRAY = '#9a9a9a';
const COLOR_RED = '#ff6b6b';

/** Bônus de dano/defesa por nível do item (+0 a +15), tabela clássica do MU. */
const LEVEL_BONUS = [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 31, 36, 42, 49, 57, 66];

const EXCELLENT_WEAPON = [
  'Aumenta a mana ao matar monstro (+mana/8)',
  'Aumenta a vida ao matar monstro (+vida/8)',
  'Aumenta a velocidade de ataque +7',
  'Aumenta o dano +2%',
  'Aumenta o dano +nível/20',
  'Taxa de dano excelente +10%',
];

const EXCELLENT_DEFENSE = [
  'Zen ao matar monstro +40%',
  'Taxa de sucesso de defesa +10%',
  'Reflete 5% do dano',
  'Reduz o dano em 4%',
  'Aumenta a mana máxima +4%',
  'Aumenta a vida máxima +4%',
];

type ItemKind = 'weapon' | 'staff' | 'shield' | 'armor' | 'wing' | 'ring' | 'pendant' | 'other';

function itemKind(group: number, num: number): ItemKind {
  if (group <= 4) return 'weapon';
  if (group === 5) return 'staff';
  if (group === 6) return 'shield';
  if (group >= 7 && group <= 11) return 'armor';
  if (group === 12 && (num <= 6 || (num >= 36 && num <= 43))) return 'wing';
  if (group === 13 && [8, 9, 10, 21, 22, 23, 24].includes(num)) return 'ring';
  if (group === 13 && [12, 13, 25, 26, 27, 28].includes(num)) return 'pendant';
  return 'other';
}

export function itemDisplayName(item: Item): string {
  const stats = ITEM_STATS[`${item.group}/${item.num}`];
  const name = stats?.[0] ?? ItemsDatabase.getItem(item.group, item.num)?.ItemName ?? `Item ${item.group}/${item.num}`;
  return item.lvl ? `${name} +${item.lvl}` : name;
}

export function describeItem(item: Item): DescriptionLine[] {
  const stats = ITEM_STATS[`${item.group}/${item.num}`];
  const lines: DescriptionLine[] = [];
  const kind = itemKind(item.group, item.num);
  const lvl = item.lvl ?? 0;
  const bonus = LEVEL_BONUS[Math.min(lvl, LEVEL_BONUS.length - 1)];
  const excellent = kind !== 'wing' && kind !== 'other' && (item.excellentBits ?? 0) !== 0;

  const nameColor = item.isAncient
    ? COLOR_ANCIENT
    : excellent
      ? COLOR_EXCELLENT
      : lvl >= 7
        ? COLOR_GOLD
        : lvl >= 4
          ? COLOR_BLUE
          : COLOR_NORMAL;
  lines.push({ text: `${excellent ? 'Excelente ' : ''}${itemDisplayName(item)}`, color: nameColor });

  if (!stats) return lines;
  const [, maxDur, dmgMin, dmgMax, speed, defense, defenseRate, magicPercent, reqLevel, reqStr, reqAgi, reqEne, reqVit, classMask] = stats;

  // Valores base do servidor (+ bônus do nível do item).
  if (dmgMax > 0) lines.push({ text: `Dano: ${dmgMin + bonus} ~ ${dmgMax + bonus}`, color: COLOR_NORMAL });
  if (magicPercent > 0) lines.push({ text: `Aumento de magia: ${magicPercent}%`, color: COLOR_NORMAL });
  if (speed > 0) lines.push({ text: `Velocidade de ataque: ${speed}`, color: COLOR_NORMAL });
  if (defense > 0) lines.push({ text: `Defesa: ${defense + bonus}`, color: COLOR_NORMAL });
  if (defenseRate > 0) lines.push({ text: `Taxa de defesa: ${defenseRate}`, color: COLOR_NORMAL });
  if (item.durability !== undefined && maxDur > 0) {
    const low = item.durability <= Math.max(1, Math.floor(maxDur * 0.2));
    lines.push({ text: `Durabilidade: ${item.durability}/${maxDur}`, color: low ? COLOR_RED : COLOR_NORMAL });
  }

  // Requisitos (valores base; o servidor aumenta com o nível do item).
  if (reqLevel > 0) lines.push({ text: `Nível necessário: ${reqLevel}`, color: COLOR_GRAY });
  if (reqStr > 0) lines.push({ text: `Força necessária: ${reqStr}`, color: COLOR_GRAY });
  if (reqAgi > 0) lines.push({ text: `Agilidade necessária: ${reqAgi}`, color: COLOR_GRAY });
  if (reqEne > 0) lines.push({ text: `Energia necessária: ${reqEne}`, color: COLOR_GRAY });
  if (reqVit > 0) lines.push({ text: `Vitalidade necessária: ${reqVit}`, color: COLOR_GRAY });

  // Quem pode usar (só as classes da versão do thegame).
  const classes = [
    [1, 'Dark Wizard'],
    [2, 'Dark Knight'],
    [4, 'Elfa'],
    [8, 'Magic Gladiator'],
  ]
    .filter(([bit]) => (classMask & (bit as number)) !== 0)
    .map(([, label]) => label);
  if (classes.length > 0 && classes.length < 4) {
    lines.push({ text: `Pode ser usado por: ${classes.join(', ')}`, color: COLOR_GRAY });
  }

  // Opções (azul) e excelentes (verde).
  if (item.hasSkill) lines.push({ text: 'Skill de arma (botão direito)', color: COLOR_BLUE });
  if (item.hasLuck) {
    lines.push({ text: 'Luck (sucesso com Jewel of Soul +25%)', color: COLOR_BLUE });
    lines.push({ text: 'Luck (taxa de dano crítico +5%)', color: COLOR_BLUE });
  }
  const opt = item.optionLevel ?? 0;
  if (opt > 0) {
    let text: string;
    if (kind === 'weapon') text = `Dano adicional +${opt * 4}`;
    else if (kind === 'staff') text = `Poder de magia adicional +${opt * 4}`;
    else if (kind === 'shield' || kind === 'armor') text = `Defesa adicional +${opt * 4}`;
    else if (kind === 'ring' || kind === 'pendant') text = `Recuperação automática de vida ${opt}%`;
    else text = `Opção adicional +${opt * 4}`;
    lines.push({ text, color: COLOR_BLUE });
  }
  if (excellent) {
    const names = kind === 'weapon' || kind === 'staff' || kind === 'pendant' ? EXCELLENT_WEAPON : EXCELLENT_DEFENSE;
    for (let bit = 5; bit >= 0; bit--) {
      if ((item.excellentBits! >> bit) & 1) lines.push({ text: names[bit], color: COLOR_EXCELLENT });
    }
  }

  return lines;
}
