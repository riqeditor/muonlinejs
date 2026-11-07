import { EventBus } from "../eventBus";
import { ConnectServerPackets, ServerToClientPackets, SimpleModulusDecryptor } from "../../common";
import { byteToString, getPacketSize, getSizeOfPacketType } from "../../common/utils";
import { CS_PORT } from "../../consts";

type Options = {
  wsAddress: string;
  tcpIP: string;
  tcpPort: number;
};

const STCPackets = [...ConnectServerPackets, ...ServerToClientPackets].filter(p => p.Direction === 'ServerToClient');

const packetsCacheByCode: (typeof STCPackets)[] = [];

STCPackets.forEach(p => {
  const code = p.Code;

  if (packetsCacheByCode[code] == null) {
    packetsCacheByCode[code] = [p];
  } else {
    packetsCacheByCode[code].push(p);
  }
});

// thegame: no ChatMessage (C1 00) o "código" do pacote é o próprio tipo da mensagem:
// 0x00 = normal e 0x02 = sussurro. As definições geradas só conhecem 0x00, e o 0x02
// está ocupado pelo PatchVersionOkay do connect server. Nas conexões com o game server
// (que nunca envia PatchVersionOkay), C1 02 é tratado como ChatMessage.
const CHAT_MESSAGE_DEF = (packetsCacheByCode[0x00] ?? []).find(p => p.Name === 'ChatMessage');
const CONNECT_SERVER_PORTS = new Set([CS_PORT, 44406]);

const HEADERS = new Set<number>([0xc1, 0xc2, 0xc3, 0xc4]);

const DEBUG_LOG = false;
const INFO_LOG = true;

export function createSocket({ wsAddress, tcpIP, tcpPort }: Options) {
  const LOG_PREFIX = `[${tcpIP}:${tcpPort}]`;

  const decryptor = new SimpleModulusDecryptor();
  decryptor.decryptionKeys = SimpleModulusDecryptor.DefaultClientKey;

  const socket = new WebSocket(
    `${wsAddress}?host=${tcpIP}&port=${tcpPort}`
  );
  socket.binaryType = "arraybuffer";

  let bytes = new Uint8Array(0);

  // thegame: a fila processa uma mensagem por vez e NUNCA pode travar.
  // Antes, uma mensagem desconhecida (ex.: C1 B2 1A, imposto do Castle Siege,
  // enviada pelo OpenMU atual) lançava um erro e ficava presa no início da fila,
  // bloqueando todas as seguintes (o "limbo" ao entrar no jogo).
  function handlePacketsQueue() {
    while (bytes.length > 0) {
      const packetType = bytes[0];

      if (!HEADERS.has(packetType)) {
        // Não é possível achar o início da próxima mensagem com segurança: descarta o que chegou.
        console.error(
          `${LOG_PREFIX}NOT_MU_PACKET: 0x${byteToString(packetType)}, descartando ${bytes.length} bytes`
        );
        bytes = new Uint8Array(0);
        return;
      }

      const packetHeaderSize = getSizeOfPacketType(packetType);
      // Precisa pelo menos do cabeçalho (tipo + tamanho) para saber o tamanho total.
      if (bytes.length < packetHeaderSize) return;

      const length = getPacketSize(bytes);
      if (length < packetHeaderSize + 1) {
        console.error(`${LOG_PREFIX}tamanho de pacote inválido (${length}), descartando a fila`);
        bytes = new Uint8Array(0);
        return;
      }

      // A mensagem ainda não chegou inteira (a rede pode dividi-la): espera o resto.
      if (bytes.length < length) return;

      const raw = bytes.slice(0, length);
      bytes = bytes.slice(length);

      processPacket(raw, packetType, packetHeaderSize);
    }
  }

  function processPacket(raw: Uint8Array, packetType: number, packetHeaderSize: number) {
    const length = raw.length;
    let packet = new DataView(raw.buffer, 0, length);
    DEBUG_LOG && console.log(`${LOG_PREFIX}Try to find packet 0x${byteToString(packetType)}, lng: ${length}`);

    if (packetType >= 0xc3) {
      const [s, decryptedPacket] = decryptor.Decrypt(raw);
      if (!s) {
        console.error(`${LOG_PREFIX} can't decrypt packet`);
        return;
      }
      packet = new DataView(decryptedPacket.buffer);
      DEBUG_LOG && console.log(`${LOG_PREFIX}Decrypted packet 0x${byteToString(packetType)}, lng: ${length}:`, decryptedPacket);
    }

    const codeIndex = packetHeaderSize === 3 ? 3 : 2;
    if (packet.byteLength <= codeIndex) {
      console.warn(`${LOG_PREFIX}pacote curto demais, ignorado`);
      return;
    }

    const packetCode = packet.getUint8(codeIndex);
    const subCode = packet.byteLength > codeIndex + 1 ? packet.getUint8(codeIndex + 1) : undefined;

    const isWhisperFromGameServer =
      packetType === 0xc1 && packetCode === 0x02 && !CONNECT_SERVER_PORTS.has(tcpPort);

    const packetsByCode = packetsCacheByCode[packetCode];
    const pDef = isWhisperFromGameServer
      ? CHAT_MESSAGE_DEF
      : packetsByCode?.find(p => p.SubCode == null || p.SubCode === subCode);

    if (!pDef) {
      // Mensagem que este cliente ainda não conhece: ignora e segue para a próxima.
      console.warn(
        `${LOG_PREFIX}pacote desconhecido ignorado: 0x${byteToString(packetCode)}` +
        (subCode !== undefined ? ` (0x${byteToString(subCode)})` : '') +
        ` lng:${length}`
      );
      return;
    }

    INFO_LOG && console.log(
      `${LOG_PREFIX}[${pDef.name}][${pDef.HeaderType}]0x${byteToString(pDef.Code)}${pDef.SubCode != null ? `(0x${byteToString(pDef.SubCode)})` : ""
      } lng:${length}`
    );

    try {
      EventBus.emit(pDef.Name, packet);
    } catch (error) {
      // Um erro ao tratar uma mensagem não pode travar as próximas.
      console.error(`${LOG_PREFIX}erro ao tratar ${pDef.Name}:`, error);
    }
  }

  socket.addEventListener("message", (event) => {
    const buffer = event.data as ArrayBuffer;

    const newBytes = new Uint8Array(buffer);
    DEBUG_LOG && console.log(`${LOG_PREFIX}received ${newBytes.length} bytes:`, newBytes);

    bytes = new Uint8Array([...bytes, ...newBytes]);
    handlePacketsQueue();
  });

  // socket opened
  socket.addEventListener("open", (event) => {
    console.log(`${LOG_PREFIX}opened:`, event);
    EventBus.emit('wsOpened', { socket });
  });

  // socket closed
  socket.addEventListener("close", (event) => {
    console.log(`${LOG_PREFIX}closed:`, event);
    EventBus.emit('wsClosed', { socket });

  });

  // error handler
  socket.addEventListener("error", (event) => {
    console.log(`${LOG_PREFIX}error:`, event);
    EventBus.emit('wsError', { socket, error: event.error });

  });

  // setInterval(()=>{
  //   if(socket && socket.readyState === socket.OPEN){
  //     socket.ping?.();
  //   }
  // },10_000);

  return { socket } as const;
}