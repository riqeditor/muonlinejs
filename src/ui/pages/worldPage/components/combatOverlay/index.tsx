import './style.less';
import { observer } from 'mobx-react-lite';
import { useRef } from 'react';
import type { With } from 'miniplex';
import { Store, type DamagePopup } from '../../../../../store';
import type { Entity } from '../../../../../ecs/world';
import { usePositionOnScreen } from '../../../../../hooks';

type ScreenEntity = With<Entity, 'transform' | 'screenPosition'>;

const DamageLabel = ({ entity, popup }: { entity: ScreenEntity; popup: DamagePopup }) => {
  const ref = useRef<HTMLDivElement>(null);
  usePositionOnScreen(entity, ref, 0, -30);

  return (
    <div ref={ref} className="damage-popup">
      <span style={{ color: popup.color }}>{popup.text}</span>
    </div>
  );
};

/** thegame: números de dano sobre os objetos e aviso de morte do jogador local. */
export const CombatOverlay = observer(() => {
  const world = Store.world;

  return (
    <>
      <div className="damage-popups">
        {world &&
          Store.damagePopups.map(popup => {
            const entity = world.netObjsQuery.entities.find(
              e => e.netId === popup.netId && e.screenPosition
            ) as ScreenEntity | undefined;
            if (!entity) return null;
            return <DamageLabel key={popup.id} entity={entity} popup={popup} />;
          })}
      </div>

      {Store.playerDead && (
        <div className="death-overlay">
          <div className="death-box">
            <h2>Você morreu</h2>
            <p>Renascendo na cidade em instantes…</p>
          </div>
        </div>
      )}
    </>
  );
});
