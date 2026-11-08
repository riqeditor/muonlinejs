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
import { TitleBackground, TitleFooter, TitleLogo } from '../../components/titleScreen';

// thegame: o servidor tem um único game server. Não há tela de escolher servidor:
// assim que o connect server manda a lista, o cliente pede a conexão do primeiro
// (menor ServerId) e segue direto para o login.

export const ServersPage = observer(() => {
  const requestConnection = (serverId: number) => {
    const packet = ConnectionInfoRequestPacket.createPacket();
    packet.ServerId = serverId;
    Store.sendToCS(packet.buffer);
  };

  useEventBus('ServerListResponse', bytes => {
    const p = new ServerListResponsePacket(bytes);
    const servers = p.getServers(p.ServerCount);
    Store.serverList = servers;

    const first = [...servers].sort((a, b) => a.ServerId - b.ServerId)[0];
    if (first) requestConnection(first.ServerId);
  });

  useEventBus('ConnectionInfo', async bytes => {
    const p = new ConnectionInfoPacket(bytes);
    const address = Store.config.csIp ?? CS_HOST; //use local host

    console.log(`connection info: ${address}:${p.Port}`);

    await Store.connectToGameServer(address, p.Port);
  });

  return (
    <div className="servers-page title-page">
      <TitleBackground />
      <TitleLogo />
      <span className="connecting">Conectando ao servidor…</span>
      <TitleFooter />
    </div>
  );
});
