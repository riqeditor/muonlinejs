import './style.less';
import { observer } from 'mobx-react-lite';
import { Store } from '../../../store';
import { useEventBus } from '../../../hooks/useEventBus';
import {
  CHARACTER_NAME_REGEX,
  MAX_CHARACTER_NAME_LENGTH,
  MIN_CHARACTER_NAME_LENGTH,
} from '../../../consts';
import { Fragment, useEffect } from 'react';
import {
  CharacterCreationSuccessfulPacket,
  CharacterFocusedPacket,
  CharacterListPacket,
  CharacterStatusEnum,
} from '../../../common/packets/ServerToClientPackets';
import { CharacterClassNumber } from '../../../common';
import {
  getCharacterClassName,
  getClassFromAppearance,
  getCreatableClasses,
} from '../../../common/characterClasses';

export const CharactersPage = observer(() => {
  useEffect(() => {
    Store.refreshCharactersListRequest();
  }, [Store]);

  useEventBus('CharacterList', bytes => {
    Store.loadingCharactersList = false;
    const p = new CharacterListPacket(bytes);

    Store.unlockFlags = p.UnlockFlags;
    Store.charactersList = p.getCharacters();
  });

  // C1 DE 00: enviado logo após a lista, se a conta tiver classes extras liberadas.
  useEventBus('CharacterClassCreationUnlock', bytes => {
    Store.unlockFlags = bytes.getUint8(4);
  });

  useEventBus('CharacterCreationFailed', () => {
    Store.characterCreationProcessing = false;
    // O servidor não informa o motivo da falha.
    Store.characterCreationError =
      'Não foi possível criar o personagem. O nome pode já estar em uso, ' +
      'a classe pode não estar liberada ou a conta já atingiu o limite de personagens.';
  });

  useEventBus('CharacterCreationSuccessful', bytes => {
    const p = new CharacterCreationSuccessfulPacket(bytes);

    Store.characterCreationProcessing = false;
    Store.characterCreationError = undefined;
    Store.newCharName = '';
    Store.newCharClass = CharacterClassNumber.DarkKnight;
    Store.addNotification(`Personagem ${p.CharacterName} criado!`, 'info');

    Store.refreshCharactersListRequest();
  });

  useEventBus('CharacterFocused', bytes => {
    const p = new CharacterFocusedPacket(bytes);

    Store.focusedChar = p.CharacterName;
  });

  const creatableClasses = getCreatableClasses(Store.unlockFlags);
  const selectedClass = creatableClasses.includes(Store.newCharClass)
    ? Store.newCharClass
    : creatableClasses[0];

  const onCharacterFocus = (name: string) => {
    Store.focusCharacterRequest(name);
  };

  const onCharacterSelect = (name: string) => {
    Store.selectCharacterRequest(name);
  };

  const onCreateSubmit = () => {
    const name = Store.newCharName.trim();

    if (!CHARACTER_NAME_REGEX.test(name)) {
      Store.characterCreationError =
        `O nome precisa ter de ${MIN_CHARACTER_NAME_LENGTH} a ${MAX_CHARACTER_NAME_LENGTH} ` +
        'caracteres, só letras sem acento e números, sem espaços.';
      return;
    }

    Store.characterCreationError = undefined;
    Store.characterCreationProcessing = true;
    Store.createCharacterRequest(name, selectedClass);
  };

  return (
    <div className="characters-page">
      {Store.loadingCharactersList ? (
        <span className="loading">Carregando personagens…</span>
      ) : (
        <Fragment>
          <section className="panel">
            <h2>Seus personagens</h2>

            {Store.charactersList.length === 0 ? (
              <p className="empty">Nenhum personagem ainda. Crie o primeiro ao lado.</p>
            ) : (
              <ul className="list">
                {Store.charactersList.map(c => {
                  const focused = c.Name === Store.focusedChar;
                  const cls = getClassFromAppearance(c.Appearance);
                  const isBanned = c.Status === CharacterStatusEnum.Banned;

                  return (
                    <li key={c.Name} className={focused ? 'focused' : ''}>
                      <button className="character" onClick={() => onCharacterFocus(c.Name)}>
                        <span className="name">
                          {c.Name}
                          {isBanned && <span className="tag banned">Banido</span>}
                        </span>
                        <span className="details">
                          {getCharacterClassName(cls)} · nível {c.Level}
                        </span>
                      </button>

                      {focused && (
                        <button className="enter" onClick={() => onCharacterSelect(c.Name)}>
                          Entrar no jogo
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="panel">
            <form
              onSubmit={e => {
                e.preventDefault();
                onCreateSubmit();
              }}
            >
              <h2>Criar personagem</h2>

              <label>
                <span>Nome</span>
                <input
                  type="text"
                  required
                  minLength={MIN_CHARACTER_NAME_LENGTH}
                  maxLength={MAX_CHARACTER_NAME_LENGTH}
                  value={Store.newCharName}
                  onChange={e => (Store.newCharName = e.target.value.trim())}
                />
              </label>

              <label>
                <span>Classe</span>
                <select
                  value={selectedClass}
                  onChange={e => {
                    Store.newCharClass = +e.target.value;
                  }}
                >
                  {creatableClasses.map(cls => (
                    <option key={cls} value={cls}>
                      {getCharacterClassName(cls)}
                    </option>
                  ))}
                </select>
              </label>

              <p className="hint">
                {MIN_CHARACTER_NAME_LENGTH} a {MAX_CHARACTER_NAME_LENGTH} letras ou números, sem
                espaços.
              </p>

              {!!Store.characterCreationError && (
                <p className="error" role="alert">
                  {Store.characterCreationError}
                </p>
              )}

              <button type="submit" disabled={Store.characterCreationProcessing}>
                {Store.characterCreationProcessing ? 'Criando…' : 'Criar'}
              </button>
            </form>
          </section>
        </Fragment>
      )}
    </div>
  );
});
