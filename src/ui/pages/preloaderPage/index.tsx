import { Store } from '../../../store';
import { TitleBackground, TitleFooter, TitleLogo } from '../../components/titleScreen';
import './style.less';

export const PreloaderPage = () => {
  return (
    <div className="preloader-page title-page">
      <TitleBackground />
      <TitleLogo />
      <div className="buttons">
        <button className="mu-button" onClick={() => Store.playOnline()}>
          Jogar
        </button>
        <button className="mu-button small" onClick={() => Store.playOffline()}>
          Demonstração offline
        </button>
      </div>
      <TitleFooter />
    </div>
  );
};
