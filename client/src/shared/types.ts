// Player types
export type Player = 'A' | 'B';

// Score
export interface Score {
  a: number;
  b: number;
}

// Table status
export type TableStatus = 'WAITING' | 'CONFIGURING' | 'LIVE' | 'FINISHED';

// Player connection
export interface PlayerConnection {
  socketId: string;
  name: string;
  role: 'REFEREE' | 'PLAYER_A' | 'PLAYER_B' | 'SPECTATOR';
  joinedAt: number;
}

// Score change for history (undo)
export interface ScoreChange {
  id: string;
  player?: Player;
  action: 'POINT' | 'CORRECTION' | 'SET_WON';
  pointsBefore: Score;
  pointsAfter: Score;
  setNumber?: number;
  timestamp: number;
}

// Match events
export type MatchEventType = 'SET_WON' | 'MATCH_WON';

export interface SetWonEvent {
  type: 'SET_WON';
  winner: Player;
  score: Score;
  setNumber: number;
}

export interface MatchWonEvent {
  type: 'MATCH_WON';
  winner: Player;
  finalScore: Score[];
  sets: Score;
}

export type MatchEvent = SetWonEvent | MatchWonEvent;

// Match config (extended)
export interface MatchConfig {
  pointsPerSet: number;
  bestOf: number;
  minDifference: number;
  handicapA?: number;
  handicapB?: number;
  initialScore?: Score;
  initialServer?: Player;
}

export interface MatchConfigExtended extends MatchConfig {
  playerNames?: { a: string; b: string };
}

// Match state (extended)
export interface MatchState {
  config: MatchConfig;
  score: {
    sets: Score;
    currentSet: Score;
    serving: Player;
  };
  swappedSides: boolean;
  midSetSwapped: boolean;
  setHistory: Score[];
  status: TableStatus;
  winner: Player | null;
}

export interface MatchStateExtended extends MatchState {
  tableId: string;
  tableName: string;
  playerNames: { a: string; b: string };
  history: ScoreChange[];
  undoAvailable: boolean;
}

// Table info (for UI)
export interface TableInfo {
  id: string;
  number: number;
  name: string;
  status: TableStatus;
  playerCount: number;
  playerNames?: { a: string; b: string };
  currentScore?: Score;
  currentSets?: Score;
  winner?: Player | null;
}

// QR Data
export interface QRData {
  hubSsid: string;
  hubIp: string;
  hubPort: number;
  tableId: string;
  tableName: string;
  pin: string;
  encryptedPin?: string; // PIN encriptado para QR
  url: string;
}

// Referee revoked event (sent when Kill-Switch is used)
export interface RefRevokedEvent {
  tableId: string;
  reason: 'Regenerado' | 'Expulsado';
}

// Owner verified event
export interface OwnerVerifiedEvent {
  token: string;
}

// Error response
export interface ErrorResponse {
  code: string;
  message: string;
}

// Table (internal)
export interface Table {
  id: string;
  number: number;
  name: string;
  status: TableStatus;
  pin: string;
  matchEngine: any;
  playerNames: { a: string; b: string };
  history: any[];
  players: PlayerConnection[];
  createdAt: number;
}