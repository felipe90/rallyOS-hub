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

// ── Sport ────────────────────────────────────────────────────────────

/** Supported sports */
export type Sport = 'tableTennis' | 'padel';

// ── Padel Point ──────────────────────────────────────────────────────

/** Padel scoring: 0, 15, 30, 40, or Advantage */
export type PadelPoint = 0 | 15 | 30 | 40 | 'AD';

// ── Sport Config ─────────────────────────────────────────────────────

export type SportConfig = TableTennisConfig | PadelConfig;

export interface TableTennisConfig {
  sport: 'tableTennis';
  pointsPerSet: number;
  bestOf: number;
  minDifference: number;
  handicapA?: number;
  handicapB?: number;
}

export interface PadelConfig {
  sport: 'padel';
  bestOf: number;
  tiebreakPoints: 7 | 10;
  gamesPerSet: number;
  goldenPoint?: boolean;
}

// ── Sport Display Score ──────────────────────────────────────────────

/** Discriminated union for frontend score display */
export type SportDisplayScore = TTPointDisplay | PadelPointDisplay;

export interface TTPointDisplay {
  type: 'tableTennis';
  leftScore: number;
  rightScore: number;
  leftSets: number;
  rightSets: number;
}

export interface PadelPointDisplay {
  type: 'padel';
  leftPoint: string;
  rightPoint: string;
  leftGames: number;
  rightGames: number;
  leftSets: number;
  rightSets: number;
}

// ── Score ───────────────────────────────────────────────────────────

export interface Score {
  a: number;
  b: number;
  /** Sport-specific detail score for padel (games, points) — additive, preserves flat a/b for backward compat */
  detailScore?: SportDisplayScore;
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
  /** Sport type — defaults to 'tableTennis' when omitted */
  sport?: Sport;
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
  /** Discriminator for sport-specific display and logic */
  sport: Sport;
}

export interface MatchStateExtended extends MatchState {
  tableId: string;
  tableName: string;
  playerNames: { a: string; b: string };
  history: ScoreChange[];
  undoAvailable: boolean;
}

// ── Aggregated History (ALL_HISTORY event) ────────────────────────

export interface AllHistoryEntry {
  tableId: string;
  tableName: string;
  status: string;
  playerNames: { a: string; b: string };
  history: ScoreChange[];
  handicap?: {
    a?: number;
    b?: number;
  };
}

// ── Court Info (formerly Table Info) ─────────────────────────────────

export interface CourtInfo {
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

export interface CourtInfoWithPin extends CourtInfo {
  pin?: string;
}

/** @deprecated Use CourtInfo instead — legacy alias for backward compat */
export type TableInfo = CourtInfo;

/** @deprecated Use CourtInfoWithPin instead — legacy alias for backward compat */
export type TableInfoWithPin = CourtInfoWithPin;

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

// ── Kiosk Notifications ────────────────────────────────────────────

export type KioskNotificationType = 'info' | 'warning' | 'error' | 'important';

export interface KioskNotificationData {
  type: KioskNotificationType;
  message: string;
  duration: number;
  timestamp: number;
}
