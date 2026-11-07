import './style.less';
import { observer } from 'mobx-react-lite';
import { Store } from '../../../store';
import {
  ConnectionInfoPacket,
  ConnectionInfoRequestPacket,
  ServerListResponsePacket,
} from '../../../common/packets/ConnectServerPackets';
import { useEventBus } from '../../../hooks/useEventBus';
import { CS_HOST } from '../../../consts';
import { ServerItem } from './ServerItem';

export const ServersPage = observer(() => {
  const hasAnyServer = Store.serverList.length > 0;

  const onConnectClick = async (serverId: number) => {
    const packet = ConnectionInfoRequestPacket.createPacket();
    packet.ServerId = serverId;

    Store.sendToCS(packet.buffer);
  };

  useEventBus('ServerListResponse', bytes => {
    const p = new ServerListResponsePacket(bytes);
    const servers = p.getServers(p.ServerCount);
    Store.serverList = servers;
  });

  useEventBus('ConnectionInfo', async bytes => {
    const p = new ConnectionInfoPacket(bytes);
    const address = Store.config.csIp ?? CS_HOST; //use local host

    console.log(`connection info: ${address}:${p.Port}`);

    await Store.connectToGameServer(address, p.Port);
  });

  return (
    <div className="servers-page">
      {!hasAnyServer ? (
        <span>Conectando ao servidor…</span>
      ) : (
        <div className="list">
          <h2 className="title">Escolha um servidor</h2>
          {Store.serverList.map(s => (
            <ServerItem
              key={s.ServerId}
              name={`Servidor ${s.ServerId + 1}`}
              load={s.LoadPercentage}
              onClick={() => onConnectClick(s.ServerId)}
            />
          ))}
        </div>
      )}
    </div>
  );
});
