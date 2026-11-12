import './style.less';
import { observer } from 'mobx-react-lite';
import { WorldObjects } from '../../components/worldObjects';
import { MapsList } from './components/mapsList';
import { BottomBar } from './components/bottomBar';
import { CharacterInfo } from './components/characterInfo';
import { Inventory } from './components/inventory';
import { ChatBox } from './components/chatBox';
import { MapLoadingOverlay } from './components/mapLoading';
import { EscMenu } from './components/escMenu';
import { CombatOverlay } from './components/combatOverlay';
import { MiniMap } from './components/miniMap';
import { NpcShop } from './components/npcShop';

const HUD = observer(() => {
  return (
    <div className="hud">
      <BottomBar />
      <div className="panels-stack">
        <NpcShop />
        <Inventory />
        <CharacterInfo />
      </div>
      <MapsList />
      <MiniMap />
      <ChatBox />
    </div>
  );
});

export const WorldPage = observer(() => {
  return (
    <div className="world-page">
      <WorldObjects />
      <CombatOverlay />
      <HUD />
      <EscMenu />
      <MapLoadingOverlay />
    </div>
  );
});
