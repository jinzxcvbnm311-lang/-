export type GameStatus = 'WAITING' | 'PLAYING' | 'ENDED';

export interface UpgradesState {
  baseLevel: number;       // Click power upgrade (+1/click)
  randomLevel: number;     // Random Click power (costs 10x, adds +0~20/click)
  autoDrillLevel: number;  // Auto clicker power (+1 score/sec)
  critLevel: number;       // Critical strike chance (critical hit increases click income)
  magnetLevel: number;     // Magnet upgrade (increases Lucky Stone chance from 1% to up to 5%)
}

export interface PlayerState {
  id: string;
  name: string;
  score: number;
  clicks: number;
  clickValue: number;
  upgrades: UpgradesState;
  hasLuckyStone: boolean; // True if a lucky stone is currently spawned on their screen
  lastActive: number;
  isHost: boolean;
}

export interface GameEventLog {
  id: string;
  timestamp: number;
  playerName: string;
  message: string;
  type: 'join' | 'upgrade' | 'lucky' | 'click' | 'win' | 'chat';
}

export interface NetworkMessage {
  type: 
    | 'JOIN'            // Sent by Client to Host upon connection
    | 'PLAYER_UPDATE'   // Sent by Client -> Host with state update
    | 'GAME_STATE'      // Sent by Host -> Client with overall state
    | 'START_GAME'      // Sent by Host -> Client to start
    | 'RESET_GAME'      // Sent by Host -> Client to reset
    | 'CHAT'            // Chat messages
    | 'EVENT_LOG';      // Broad game events (e.g. Lucky Stones clicked)
  senderId: string;
  senderName: string;
  payload: any;
}
