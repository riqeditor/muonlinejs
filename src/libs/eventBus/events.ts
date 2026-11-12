import type { IVector2Like, IVector3Like } from '../babylon/exports';
import type {
  ConnectServerPackets,
  ENUM_WORLD,
  ServerToClientPackets,
} from '../../common';
import type { Entity } from '../../ecs/world';
import type { With } from 'miniplex';

type CSPacketKeys = (typeof ConnectServerPackets)[number]['Name'];
type GSPacketKeys = (typeof ServerToClientPackets)[number]['Name'];

export type CSEvents = Record<CSPacketKeys, DataView>;
export type GSEvents = Record<GSPacketKeys, DataView>;

export type Events = CSEvents &
  GSEvents & {
    wsOpened: { socket: WebSocket };
    wsClosed: { socket: WebSocket };
    wsError: { socket: WebSocket; error: any };
    groundPointClicked: { point: IVector3Like };
    entityScreenPositionUpdated: {
      entity: With<Entity, 'transform' | 'screenPosition'>;
      screenPosition: IVector2Like;
    };
    requestWarp: { map: ENUM_WORLD; pos?: { x: number; y: number } };
    warpCompleted: { map: ENUM_WORLD };
    /** thegame: pacote que as definições geradas não conhecem (código, subcódigo, bytes). */
    unknownPacket: { code: number; subCode?: number; packet: DataView };
    keyPressed: string;
    keyReleased: string;
    pageVisibilityChanged: boolean;
  };
