import './style.less';
import { observer } from 'mobx-react-lite';
import { runInAction } from 'mobx';
import { Store } from '../../../../../store';
import { useEventBus } from '../../../../../hooks/useEventBus';

// thegame: Esc, como no MU: primeiro cancela o item "na mão", depois fecha o
// inventário, e só então abre/fecha o menu (trocar de personagem / sair).
// Há um único servidor, então não existe "trocar de servidor".

export const EscMenu = observer(() => {
  useEventBus('keyPressed', key => {
    if (key !== 'Escape') return;
    runInAction(() => {
      if (Store.heldItemSlot !== null) {
        Store.heldItemSlot = null;
        Store.heldItemDragging = false;
      } else if (Store.inventoryEnabled) {
        Store.inventoryEnabled = false;
      } else {
        Store.escMenuOpen = !Store.escMenuOpen;
      }
    });
  });

  if (!Store.escMenuOpen) return null;

  const close = () => runInAction(() => (Store.escMenuOpen = false));

  return (
    <div className="esc-menu-backdrop" onPointerDown={close}>
      <div className="esc-menu" onPointerDown={e => e.stopPropagation()}>
        <div className="title">Menu</div>
        <button
          onClick={() => {
            close();
            Store.sendLogout(1);
          }}
        >
          Trocar de personagem
        </button>
        <button
          onClick={() => {
            close();
            Store.sendLogout(0);
            // Se o servidor não responder, sai mesmo assim.
            setTimeout(() => location.reload(), 1500);
          }}
        >
          Sair do jogo
        </button>
        <button className="secondary" onClick={close}>
          Voltar ao jogo (Esc)
        </button>
      </div>
    </div>
  );
});
