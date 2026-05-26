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

/** Sport identifier const — use instead of magic strings */
export const SPORT = {
  TABLE_TENNIS: 'tableTennis',
  PADEL: 'padel',
} as const;

/** Supported sports — derived from SPORT const */
export type Sport = (typeof SPORT)[keyof typeof SPORT];

// ── Padel Point ──────────────────────────────────────────────────────

/** Padel scoring: 0, 15, 30, 40, or Advantage */
export type PadelPoint = 0 | 15 | 30 | 40 | 'AD';

// ── Sport Config ─────────────────────────────────────────────────────

/** Union of all sport configs — use TableTennisMatchConfig | PadelMatchConfig */
export type SportConfig = TableTennisMatchConfig | PadelMatchConfig;

// ── Sport Display Score ──────────────────────────────────────────────

/** Discriminated union for frontend score display */
export type SportDisplayScore = TTPointDisplay | PadelPointDisplay;

export interface TTPointDisplay {
  type: typeof SPORT.TABLE_TENNIS;
  leftScore: number;
  rightScore: number;
  leftSets: number;
  rightSets: number;
}

export interface PadelPointDisplay {
  type: typeof SPORT.PADEL;
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

export type MatchEventType = 'SET_WON' | 'MATCH_WON' | 'GAME_WON' | 'DEUCE' | 'TIEBREAK_START';

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

export interface GameWonEvent {
  type: 'GAME_WON';
  winner: Player;
  score: { a: PadelPoint; b: PadelPoint };
  gameNumber: number;
}

export interface DeuceEvent {
  type: 'DEUCE';
}

export interface TiebreakStartEvent {
  type: 'TIEBREAK_START';
  targetPoints: number;
}

export type MatchEvent = SetWonEvent | MatchWonEvent | GameWonEvent | DeuceEvent | TiebreakStartEvent;

// ── Match Config (Discriminated Union) ───────────────────────────────

/** Base config fields common to ALL sports */
export interface MatchConfigBase {
  bestOf: number;
  initialScore?: Score;
  initialServer?: Player;
}

export interface TableTennisMatchConfig extends MatchConfigBase {
  sport: typeof SPORT.TABLE_TENNIS;
  pointsPerSet: number;
  minDifference: number;
  handicapA?: number;
  handicapB?: number;
}

export interface PadelMatchConfig extends MatchConfigBase {
  sport: typeof SPORT.PADEL;
  tiebreakPoints: 7 | 10;
  gamesPerSet: number;
  goldenPoint?: boolean;
}

export type MatchConfig = TableTennisMatchConfig | PadelMatchConfig;

export type MatchConfigExtended = MatchConfig & {
  playerNames?: { a: string; b: string };
};

// ── Match State (Discriminated Union) ────────────────────────────────

/** Base state fields common to ALL sports */
export interface MatchStateBase {
  config: MatchConfig;
  status: TableStatus;
  winner: Player | null;
  swappedSides: boolean;
  midSetSwapped: boolean;
}

export interface TableTennisMatchState extends MatchStateBase {
  sport: typeof SPORT.TABLE_TENNIS;
  score: {
    sets: Score;
    currentSet: Score;
    serving: Player;
  };
  setHistory: Score[];
}

export interface PadelMatchState extends MatchStateBase {
  sport: typeof SPORT.PADEL;
  /** Current point values (0, 15, 30, 40, AD) */
  padelPoints: { a: PadelPoint; b: PadelPoint };
  /** Games count (current set) */
  games: { a: number; b: number };
  /** Sets count */
  sets: { a: number; b: number };
  /** Whether the current game is a tiebreak */
  isTiebreak: boolean;
  /** Current tiebreak point counts */
  tiebreakPoints: { a: number; b: number };
  /** Tiebreak target points (7 or 10) */
  tiebreakTarget: 7 | 10;
  /** Golden point / sudden death at deuce */
  goldenPoint: boolean;
  /** Current server */
  serving: Player;
  /** Completed set scores */
  setHistory: Score[];
}

export type MatchState = TableTennisMatchState | PadelMatchState;

export type MatchStateExtended = MatchState & {
  tableId: string;
  tableName: string;
  playerNames: { a: string; b: string };
  history: ScoreChange[];
  undoAvailable: boolean;
};

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

// ── Type Guard Helpers ────────────────────────────────────────────────

/** Narrow a MatchConfig to TableTennisMatchConfig. Defaults to TT when sport is absent. */
export function isTableTennisConfig(config: MatchConfig | Partial<MatchConfig>): config is TableTennisMatchConfig {
  return !config || !('sport' in config) || config.sport === SPORT.TABLE_TENNIS || config.sport === undefined;
}

/** Narrow a MatchConfig to PadelMatchConfig. */
export function isPadelConfig(config: MatchConfig | Partial<MatchConfig>): config is PadelMatchConfig {
  return 'sport' in config && config.sport === SPORT.PADEL;
}

/** Narrow a MatchState to TableTennisMatchState. */
export function isTableTennisState(state: MatchState): state is TableTennisMatchState {
  return state.sport === SPORT.TABLE_TENNIS;
}

/** Narrow a MatchState to PadelMatchState. */
export function isPadelState(state: MatchState): state is PadelMatchState {
  return state.sport === SPORT.PADEL;
}

/** Narrow a MatchStateExtended to the table tennis variant. */
export function isTableTennisStateExtended(state: MatchStateExtended): state is MatchStateExtended & TableTennisMatchState {
  return state.sport === SPORT.TABLE_TENNIS;
}

/** Narrow a MatchStateExtended to the padel variant. */
export function isPadelStateExtended(state: MatchStateExtended): state is MatchStateExtended & PadelMatchState {
  return state.sport === SPORT.PADEL;
}
