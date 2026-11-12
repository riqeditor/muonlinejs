import './style.less';
import { observer } from 'mobx-react-lite';
import { runInAction } from 'mobx';
import { Store } from '../../../../../store';
import { useEventBus } from '../../../../../hooks/useEventBus';

// thegame: party. Janela (tecla P) com os membros (vida, mapa, sair/expulsar) e os jogadores
// por perto (convidar). Barrinhas de vida dos membros ficam sempre no canto. O convite
// recebido aparece numa caixa com Aceitar/Recusar. Quem divide a experiência é o servidor.

const MAP_NAMES: Record<number, string> = {
  0: 'Lorencia',
  1: 'Dungeon',
  2: 'Devias',
  3: 'Noria',
  4: 'Lost Tower',
  6: 'Arena',
  7: 'Atlans',
  8: 'Tarkan',
  10: 'Icarus',
};

const HOT_KEY = 'KeyP';

const hpPercent = (hp: number, max: number) => (max > 0 ? Math.max(0, Math.min(100, (hp / max) * 100)) : 0);

/** Barrinhas de vida dos outros membros, sempre visíveis. */
const PartyBars = observer(() => {
  const others = Store.partyMembers.filter(m => m.name !== Store.characterName);
  if (others.length === 0) return null;
  return (
    <div className="party-bars">
      {others.map(m => (
        <div key={m.index} className="party-bar" title={`${m.name}: ${m.hp}/${m.maxHp} · ${MAP_NAMES[m.map] ?? ''} ${m.x},${m.y}`}>
          <span className="name">{m.name}</span>
          <div className="bar">
            <div className="fill" style={{ width: `${hpPercent(m.hp, m.maxHp)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
});

const PartyInvite = observer(() => {
  const invite = Store.partyInvite;
  if (!invite) return null;
  return (
    <div className="party-invite mu-window" onPointerDown={e => e.stopPropagation()}>
      <span>
        <b>{invite.name}</b> convidou você para a party.
      </span>
      <div className="buttons">
        <button className="mu-button small" onClick={() => Store.answerPartyInvite(true)}>
          Aceitar
        </button>
        <button className="mu-button small" onClick={() => Store.answerPartyInvite(false)}>
          Recusar
        </button>
      </div>
    </div>
  );
});

const PartyWindow = observer(() => {
  if (!Store.partyWindowOpen) return null;

  const members = Store.partyMembers;
  const me = members.find(m => m.name === Store.characterName);
  const isLeader = !!me && me.index === 0;
  const inParty = new Set(members.map(m => m.name));
  const nearby = (Store.world?.netObjsQuery.entities ?? []).filter(
    e =>
      e.playerAnimation &&
      e.netId !== undefined &&
      !e.objOutOfScope &&
      e !== Store.world?.playerEntity &&
      e.npcType === undefined &&
      !inParty.has(e.objectNameInWorld ?? '')
  );
  const canInvite = members.length === 0 || isLeader;

  return (
    <div className="party-window mu-window" onPointerDown={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}>
      <span className="title">Party</span>

      {members.length === 0 ? (
        <p className="empty">Você não está em uma party.</p>
      ) : (
        <ul className="members">
          {members.map(m => (
            <li key={m.index}>
              <div className="top">
                <span className="name">
                  {m.index === 0 && <span className="leader" title="Líder">★ </span>}
                  {m.name}
                </span>
                <span className="where">
                  {MAP_NAMES[m.map] ?? `mapa ${m.map}`} {m.x},{m.y}
                </span>
              </div>
              <div className="bar">
                <div className="fill" style={{ width: `${hpPercent(m.hp, m.maxHp)}%` }} />
                <span className="hp">
                  {m.hp}/{m.maxHp}
                </span>
              </div>
              {isLeader && m.name !== Store.characterName && (
                <button className="mu-button small kick" onClick={() => Store.kickPartyMember(m.index)}>
                  Expulsar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {members.length > 0 && (
        <button className="mu-button small" onClick={() => Store.leaveParty()}>
          Sair da party
        </button>
      )}

      {(
        <>
          <span className="subtitle">Jogadores por perto</span>
          {nearby.length === 0 ? (
            <p className="empty">Ninguém por perto.</p>
          ) : (
            <ul className="nearby">
              {nearby.map(e => (
                <li key={e.netId}>
                  <span>{e.objectNameInWorld}</span>
                  <span className="actions">
                    <button className="mu-button small" onClick={() => Store.requestTrade(e.netId!)}>
                      Trocar
                    </button>
                    {canInvite && (
                      <button className="mu-button small" onClick={() => Store.invitePlayerToParty(e.netId!)}>
                        Convidar
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      <span className="hint">No chat: /party Nome (convidar) · /troca Nome (trocar)</span>
    </div>
  );
});

export const Party = observer(() => {
  useEventBus('keyPressed', key => {
    if (key === HOT_KEY) runInAction(() => (Store.partyWindowOpen = !Store.partyWindowOpen));
  });
  return (
    <>
      <PartyBars />
      <PartyInvite />
      <PartyWindow />
    </>
  );
});
