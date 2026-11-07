import { EventBus } from '../../libs/eventBus';
import type { ISystemFactory } from '../world';
import { isTypingInField } from '../../common/utf8';

export const KeyboardInputSystem: ISystemFactory = world => {
  const pressedKeys = new Set<string>();

  document.addEventListener('keydown', e => {
    // thegame: teclas digitadas no chat/login não são atalhos do jogo.
    if (isTypingInField(e.target)) return;
    if (!pressedKeys.has(e.code)) {
      EventBus.emit('keyPressed', e.code);
    }
    pressedKeys.add(e.code);
  });

  document.addEventListener('keyup', e => {
    if (pressedKeys.has(e.code)) {
      EventBus.emit('keyReleased', e.code);
    }
    pressedKeys.delete(e.code);
  });

  const clear = () => {
    pressedKeys.forEach(code => {
      EventBus.emit('keyReleased', code);
    });

    pressedKeys.clear();
  };

  EventBus.on('pageVisibilityChanged', visible => {
    if (visible) return;
    clear();
  });

  window.addEventListener('blur', () => {
    clear();
  });

  const keyboardInput = world.keyboardInput;

  return {
    update: () => {
      keyboardInput.pressedKeys = pressedKeys;
    },
  };
};
