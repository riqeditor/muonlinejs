import './style.less';
import { observer } from 'mobx-react-lite';
import { Store } from '../../../../../store';

/** thegame: cobre a tela enquanto o mapa e as texturas carregam (sem objetos brancos). */
export const MapLoadingOverlay = observer(() => {
  if (!Store.mapLoading) return null;

  return (
    <div className="map-loading">
      <div className="box">
        <div className="title">thegame</div>
        <div className="text">Carregando mapa…</div>
        <div className="bar">
          <div className="fill" />
        </div>
      </div>
    </div>
  );
});
