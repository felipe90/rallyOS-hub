/**
 * Server Internal Types
 *
 * This file ONLY defines types that are internal to the server and do NOT
 * cross the wire to the client. All API types (shared between client/server)
 * MUST be imported from `../../shared/types`.
 *
 * Rule: Never duplicate a type that exists in `shared/types.ts`.
 * If you need it on both sides, it belongs in `shared/types.ts`.
 */

import {
  Player,
  Score,
  CourtStatus, TournamentStatus,
  ScoreChange,
  MatchEventType,
  SetWonEvent,
  MatchWonEvent,
  MatchEvent,
  MatchConfig,
  MatchConfigExtended,
  MatchState,
  MatchStateExtended,
  CourtInfo,
  CourtInfoWithPin,
  QRData,
  ErrorResponse,
  ValidationError,
  TableTennisMatchConfig,
  PadelMatchConfig,
  PadelPoint,
  Sport,
  SPORT,
  CourtMode,
  COURT_MODE,
  ClubStatus,
  CLUB_STATUS,
  SessionMode,
  SESSION_MODE,
} from '../../../shared/types';
import type { MatchEngine } from './matchEngine';

// Re-export persistence types from domain/ports for backward compatibility
// Consumers can now import PersistedCourt, PersistedClubCourt, etc. from
// either domain/types or domain/ports/persistence-types.
export type {
  PersistedCourt,
  PersistedClubCourt,
  PersistedMatchState,
  PersistedTable,
} from './ports/persistence-types';

// Re-export everything from shared so consumers can still `import { X } from './types'`
export {
  Player,
  Score,
  CourtStatus, TournamentStatus,
  ScoreChange,
  MatchEventType,
  SetWonEvent,
  MatchWonEvent,
  MatchEvent,
  MatchConfig,
  MatchConfigExtended,
  MatchState,
  MatchStateExtended,
  CourtInfo,
  CourtInfoWithPin,
  QRData,
  ErrorResponse,
  ValidationError,
  TableTennisMatchConfig,
  PadelMatchConfig,
  PadelPoint,
  Sport,
  SPORT,
  CourtMode,
  COURT_MODE,
  ClubStatus,
  CLUB_STATUS,
  SessionMode,
  SESSION_MODE,
};

/**
 * Hub configuration (internal server-only)
 *
 * Used for QR data generation and server startup.
 * Never sent to the client in raw form — only via QRData fields.
 */
export interface HubConfig {
  ssid: string;
  ip: string;
  port: number;
  domain: string;
  wifiPassword: string;
}

/**
 * Player connection (internal server-only)
 *
 * Tracks connected players/spectators/referees per table.
 * Never sent to the client in this raw form.
 */
export interface PlayerConnection {
  socketId: string;
  name: string;
  role: 'REFEREE' | 'PLAYER_A' | 'PLAYER_B' | 'SPECTATOR';
  joinedAt: number;
}

/**
 * TournamentCourt — A court in tournament mode.
 *
 * Has `status: TournamentStatus` to track match lifecycle.
 * Does NOT have club-specific fields (clubStatus, occupiedAt, mode).
 */
export interface TournamentCourt {
  kind: 'tournament';
  id: string;
  number: number;
  name: string;
  status: TournamentStatus;
  pin: string;
  sportRules: MatchEngine;
  playerNames: { a: string; b: string };
  history: MatchEvent[];
  players: PlayerConnection[];
  createdAt: number;
  /** Whether this court is currently featured/spotlight on the kiosk */
  featured: boolean;
  // Event callbacks — internal wiring, never exposed to client
  onTableUpdate?: () => void;
  onMatchEvent?: (event: MatchEvent) => void;
}

/**
 * ClubCourt — A court in club mode.
 *
 * Has `clubStatus: ClubStatus` for club lifecycle (AVAILABLE, RESERVED,
 * OCCUPIED, FINISHED, MAINTENANCE) and `occupiedAt` for session tracking.
 * Does NOT have tournament-specific fields (status).
 */
export interface ClubCourt {
  kind: 'club';
  id: string;
  number: number;
  name: string;
  clubStatus: ClubStatus;
  pin: string;
  sportRules: MatchEngine;
  playerNames: { a: string; b: string };
  history: MatchEvent[];
  players: PlayerConnection[];
  createdAt: number;
  /** Whether this court is currently featured/spotlight on the kiosk */
  featured: boolean;
  /** Epoch ms when the court was first occupied (set on RESERVED→OCCUPIED transition) */
  occupiedAt: number | null;
  /** Active session mode — 'free' | 'match'. Null when court is not in an active session (AVAILABLE/RESERVED/FINISHED). */
  sessionMode: SessionMode | null;
  // ── player-identity additions (spec: session-record MODIFIED) ──────────
  // Player name snapshot captured at session-start (CLUB_START_FREE /
  // CLUB_NEW_MATCH / CLUB_ADMIN_OCCUPY). Null on creation; populated by
  // `occupyClubCourt` defaults to null and is filled in by
  // `startFreePlay`/`newMatch`/`adminOccupyCourt` (Phase 2/3). Cleared back
  // to null by `resetCourt`.
  playerName: string | null;
  // Phone — AES-256-GCM base64 ciphertext string. Null on creation;
  // populated alongside playerName. Server NEVER decrypts inside the
  // session flow; only the phone-reveal handler (Phase 4) decrypts server-side.
  phone: string | null;
  // Admin socket id who started the session (`socket.data.adminId` set at
  // CLUB_VERIFY_ADMIN). Null for player-initiated sessions. Cleared back
  // to null by `resetCourt`.
  adminId: string | null;
  // Event callbacks — internal wiring, never exposed to client
  onTableUpdate?: () => void;
  onMatchEvent?: (event: MatchEvent) => void;
}

/** Discriminated union — use `kind` to narrow. */
export type Court = TournamentCourt | ClubCourt;

/** Type guard: narrow Court → ClubCourt */
export function isClubCourt(court: Court): court is ClubCourt {
  return court.kind === 'club';
}

/** Type guard: narrow Court → TournamentCourt */
export function isTournamentCourt(court: Court): court is TournamentCourt {
  return court.kind === 'tournament';
}

/** @deprecated Use Court instead — legacy alias for backward compat */
export type Table = Court;

/**
 * Socket data attached to authenticated sockets.
 * Replaces (socket as any).data pattern.
 */
export interface SocketData {
  isOwner?: boolean;
  isAuthenticated?: boolean;
  sessionToken?: string;
  tableId?: string;
  roles?: string[];
  isClubAdmin?: boolean;
}
