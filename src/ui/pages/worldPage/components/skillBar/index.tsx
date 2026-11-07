import './style.less';
import { observer } from 'mobx-react-lite';
import { runInAction } from 'mobx';
import { Store } from '../../../../../store';
import { useEventBus } from '../../../../../hooks/useEventBus';
import { SKILL_DEFINITIONS, SkillKind } from '../../../../../common/skills/skillDefinitions';

// thegame: barra de habilidades do personagem (vem do servidor, C1 F3 11).
// Clique ou teclas 1–5 selecionam; o botão direito no mapa usa a selecionada.

const MAX_SLOTS = 10;
const SELECT_KEYS: Record<string, number> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Digit5: 4,
};

function usableSkills() {
  return Store.skills.filter(s => {
    const def = SKILL_DEFINITIONS[s.number];
    return !!def && def[1] !== SkillKind.PassiveBoost;
  });
}

function shortName(name: string): string {
  const words = name.split(' ');
  if (words.length === 1) return name.slice(0, 7);
  return words.map(w => w[0]).join('').slice(0, 4).toUpperCase();
}

export const SkillBar = observer(() => {
  useEventBus('keyPressed', key => {
    const slot = SELECT_KEYS[key];
    if (slot === undefined) return;
    const skill = usableSkills()[slot];
    if (skill) runInAction(() => (Store.selectedSkill = skill.number));
  });

  const skills = usableSkills().slice(0, MAX_SLOTS);
  if (skills.length === 0) return null;

  return (
    <div className="skill-bar">
      {skills.map((skill, i) => {
        const [name] = SKILL_DEFINITIONS[skill.number];
        const selected = Store.selectedSkill === skill.number;
        return (
          <button
            key={skill.number}
            className={selected ? 'selected' : ''}
            title={`${name}${i < 5 ? ` (tecla ${i + 1})` : ''} — botão direito no mapa para usar`}
            onClick={e => {
              e.stopPropagation();
              runInAction(() => (Store.selectedSkill = skill.number));
            }}
          >
            {i < 5 && <span className="key">{i + 1}</span>}
            <span className="name">{shortName(name)}</span>
          </button>
        );
      })}
    </div>
  );
});
