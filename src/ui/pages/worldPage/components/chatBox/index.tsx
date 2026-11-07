import './style.less';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';
import { runInAction } from 'mobx';
import { Store } from '../../../../../store';
import { isTypingInField } from '../../../../../common/utf8';

const MAX_INPUT_LENGTH = 60;

/**
 * thegame: caixa de chat. Enter abre o campo / envia, Esc fecha.
 * "/w Nome mensagem" envia um sussurro.
 */
export const ChatBox = observer(() => {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Enter (fora de outro campo de texto) abre o chat.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || Store.chatOpen || isTypingInField(e.target)) return;
      e.preventDefault();
      runInAction(() => {
        Store.chatOpen = true;
      });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (Store.chatOpen) inputRef.current?.focus();
  }, [Store.chatOpen]);

  // Sempre mostra a mensagem mais recente.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [Store.chatMessages.length]);

  const close = () =>
    runInAction(() => {
      Store.chatOpen = false;
      Store.chatInput = '';
    });

  return (
    <div className={`chat-box ${Store.chatOpen ? 'open' : ''}`}>
      <ul className="messages scrollable" ref={listRef}>
        {Store.chatMessages.map(m => (
          <li key={m.id} className={m.kind}>
            {m.kind === 'normal' && <span className="sender">{m.sender}: </span>}
            {m.kind === 'whisper' && <span className="sender">[de {m.sender}] </span>}
            {m.kind === 'whisper-sent' && <span className="sender">[para {m.sender}] </span>}
            <span className="text">{m.text}</span>
          </li>
        ))}
      </ul>

      {Store.chatOpen ? (
        <form
          onSubmit={e => {
            e.preventDefault();
            Store.sendChatMessage(Store.chatInput);
            close();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={Store.chatInput}
            maxLength={MAX_INPUT_LENGTH}
            placeholder="Mensagem (Enter envia, Esc fecha, /w Nome texto = sussurro)"
            onChange={e => runInAction(() => (Store.chatInput = e.target.value))}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                e.preventDefault();
                close();
              }
            }}
            onBlur={() => {
              if (!Store.chatInput) close();
            }}
          />
        </form>
      ) : (
        <button
          type="button"
          className="open-button"
          onClick={() => runInAction(() => (Store.chatOpen = true))}
        >
          Chat (Enter)
        </button>
      )}
    </div>
  );
});
