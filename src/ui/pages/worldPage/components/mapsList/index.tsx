import './style.less';
import { observer } from 'mobx-react-lite';
import { runInAction } from 'mobx';
import { Store } from '../../../../../store';
import { EventBus } from '../../../../../libs/eventBus';
import { useEventBus } from '../../../../../hooks/useEventBus';
import { ENUM_WORLD } from '../../../../../common';

// thegame: janela de teleporte (tecla M), com os destinos cadastrados no servidor
// (config."WarpInfo", só os 9 mapas da especificação). O servidor confere nível e cobra o zen.
// Valores iguais aos do banco (servidor/config/02-mapas.sql); se mudar lá, mudar aqui.

type Warp = { index: number; name: string; level: number; cost: number };

const WARPS: Warp[] = [
  { index: 2, name: 'Lorencia', level: 10, cost: 2000 },
  { index: 3, name: 'Noria', level: 10, cost: 2000 },
  { index: 4, name: 'Devias', level: 20, cost: 2000 },
  { index: 5, name: 'Devias 2', level: 20, cost: 2500 },
  { index: 6, name: 'Devias 3', level: 20, cost: 3000 },
  { index: 7, name: 'Devias 4', level: 20, cost: 3500 },
  { index: 8, name: 'Dungeon', level: 30, cost: 3000 },
  { index: 9, name: 'Dungeon 2', level: 40, cost: 3500 },
  { index: 10, name: 'Dungeon 3', level: 50, cost: 4000 },
  { index: 14, name: 'Lost Tower', level: 50, cost: 5000 },
  { index: 15, name: 'Lost Tower 2', level: 50, cost: 5500 },
  { index: 16, name: 'Lost Tower 3', level: 50, cost: 6000 },
  { index: 17, name: 'Lost Tower 4', level: 60, cost: 6500 },
  { index: 18, name: 'Lost Tower 5', level: 60, cost: 7000 },
  { index: 19, name: 'Lost Tower 6', level: 70, cost: 7500 },
  { index: 20, name: 'Lost Tower 7', level: 70, cost: 8000 },
  { index: 11, name: 'Atlans', level: 70, cost: 4000 },
  { index: 12, name: 'Atlans 2', level: 80, cost: 4500 },
  { index: 13, name: 'Atlans 3', level: 90, cost: 5000 },
  { index: 21, name: 'Tarkan', level: 140, cost: 8000 },
  { index: 22, name: 'Tarkan 2', level: 140, cost: 8500 },
  { index: 23, name: 'Icarus', level: 170, cost: 10000 },
  { index: 1, name: 'Arena', level: 200, cost: 2000 },
];

/** Magic Gladiator (e Dark Lord) precisam de 2/3 do nível para se mover (regra do MU/OpenMU). */
function effectiveLevel(level: number): number {
  return Store.characterClassName?.startsWith('Magic') ? Math.floor((level * 2) / 3) : level;
}

const HOT_KEY = 'KeyM';

export const MapsList = observer(() => {
  const show = Store.warpListOpen;
  const close = () => runInAction(() => (Store.warpListOpen = false));

  useEventBus('keyPressed', key => {
    if (key === HOT_KEY) runInAction(() => (Store.warpListOpen = !Store.warpListOpen));
  });

  if (!show) return null;

  const level = Store.playerData.level;
  const money = Store.playerData.money;

  const onWarp = (warp: Warp) => {
    close();
    if (Store.isOffline) {
      EventBus.emit('requestWarp', { map: ENUM_WORLD.WD_0LORENCIA });
      return;
    }
    Store.sendWarpRequest(warp.index);
  };

  return (
    <div className="maps-list" onPointerDown={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}>
      <p className="maps-list-title">Teleporte</p>
      <table>
        <thead>
          <tr>
            <th>Destino</th>
            <th>Nível</th>
            <th>Zen</th>
          </tr>
        </thead>
        <tbody>
          {WARPS.map(warp => {
            const req = effectiveLevel(warp.level);
            const ok = level >= req && money >= warp.cost;
            return (
              <tr
                key={warp.index}
                className={ok ? '' : 'locked'}
                title={ok ? `Ir para ${warp.name}` : level < req ? `Precisa do nível ${req}` : 'Zen insuficiente'}
                onClick={() => ok && onWarp(warp)}
              >
                <td>{warp.name}</td>
                <td>{req}</td>
                <td>{warp.cost.toLocaleString('pt-BR')}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <button className="mu-button small close-button" onClick={close}>
        Fechar (M)
      </button>
    </div>
  );
});
