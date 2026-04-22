/**
 * Shared API Types — Single Source of Truth
 *
 * These types define the WebSocket API contract between client and server.
 * ONLY types that appear in event payloads (sent over the wire) belong here.
 *
 * Rule: If a type is used in a socket event payload (client ↔ server),
 *       it MUST be defined here. Never duplicate in client/src/ or server/src/.
 */

// ── Player ──────────────────────────────────────────────────────────

export type Player = 'A' | 'B';

// ── Score ───────────────────────────────────────────────────────────

export interface Score {
  a: number;
  b: number;
}

// ── Table Status ────────────────────────────────────────────────────

export type TableStatus = 'WAITING' | 'CONFIGURING' | 'LIVE' | 'FINISHED';

// ── Score Change (for history / undo) ───────────────────────────────

export interface ScoreChange {
  id: string;
  player?: Player;
  action: 'POINT' | 'CORRECTION' | 'SET_WON';
  pointsBefore: Score;
  pointsAfter: Score;
  setNumber?: number;
  timestamp: number;
}

// ── Match Events ────────────────────────────────────────────────────

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

// ── Match Config ────────────────────────────────────────────────────

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

// ── Match State ─────────────────────────────────────────────────────

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

// ── Table Info (sent to client) ─────────────────────────────────────

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

export interface TableInfoWithPin extends TableInfo {
  pin?: string;
}

// ── QR Data ─────────────────────────────────────────────────────────

export interface QRData {
  hubSsid: string;
  hubIp: string;
  hubPort: number;
  tableId: string;
  tableName: string;
  pin: string;
  encryptedPin: string;  // required: format {iv}:{ciphertext}:{authTag}:{timestamp}
  url: string;           // rallyhub://join/{tableId}?ePin={encryptedPin}
}

// ── Error Responses ─────────────────────────────────────────────────

export interface ErrorResponse {
  code: string;
  message: string;
}

export interface ValidationError {
  code: 'VALIDATION_ERROR';
  message: string;
  field: string;
  expected: string;
  received: string;
}

// ── Referee Revoked Event ───────────────────────────────────────────

export interface RefRevokedEvent {
  tableId: string;
  reason: 'Regenerado' | 'Expulsado';
}
