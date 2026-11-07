import { Store } from '../../../store';
import { FanDisclaimer } from '../../components/fanDisclaimer';
import './style.less';

export const PreloaderPage = () => {
  return (
    <div className="preloader-page">
      <h1 className="game-title">thegame</h1>
      <div className="buttons">
        <button onClick={() => Store.playOnline()}>Jogar online</button>
        <button onClick={() => Store.playOffline()}>
          Demonstração offline
        </button>
      </div>
      <FanDisclaimer />
    </div>
  );
};
