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
  CourtRecord,
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
  PersistedFlowSession,
  PersistedStateV4,
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
  CourtRecord,
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
 * Tracks connected players/spectators/referees per court.
 * Never sent to the client in this raw form.
 */
export interface PlayerConnection {
  socketId: string;
  name: string;
  role: 'REFEREE' | 'PLAYER_A' | 'PLAYER_B' | 'SPECTATOR';
  joinedAt: number;
}

/** Flow-mode discriminator key — extendable ('clase' registers one contract). */
export type FlowModeKey = 'tournament' | 'club';

/**
 * FlowSlot — the ONE active flow on a runtime court (D1).
 * `null` = no active flow → court is IDLE.
 * tournament: LIVE while a bracket match runs on the court.
 * club: OCCUPIED (timer/cost running) → FINISHED, with session identity
 *       (playerName/phone/adminId) carried on the slot.
 */
export type FlowSlot =
  | { mode: 'tournament'; state: 'LIVE'; startedAt: number }
  | {
      mode: 'club';
      state: 'OCCUPIED' | 'FINISHED';
      sessionMode: SessionMode | null;
      occupiedAt: number | null;
      playerName: string | null;
      phone: string | null;
      adminId: string | null;
    }
  | null;

/**
 * RuntimeCourt — the in-memory court entity (D1). THE single runtime court
 * type: the legacy `TournamentCourt`/`ClubCourt` union and the
 * `isClubCourt`/`isTournamentCourt` guards are REMOVED (admin-court-inventory
 * slice 5 — bridge reversal). One physical court = ONE entity; the kind is
 * DERIVED from the active `flow`, never stored.
 *
 * - `record` is the durable inventory identity (CourtRecord); `flow` is the
 *   transient active session (or null → IDLE); availability is DERIVED from
 *   (record.inventoryStatus, flow, bracket binding) — never stored (INV-4).
 * - `reserved` is the club pre-flow pending-PIN state (RESERVED, Q2) — a
 *   court with no flow yet but a live session PIN.
 *
 * DEVIATION (documented): the runtime court retains the legacy projection
 * fields (`status`, `clubStatus`, `occupiedAt`, `sessionMode`, `playerName`,
 * `phone`, `adminId`, `playerNames`, `history`, `createdAt`) because the
 * wire/UI layer (CourtInfo, kiosk payload) and the pre-slice-5 test suites
 * consume them. They are NOT a second source of truth: `flow` is
 * authoritative, and every flow mutation (CourtManager/flow contracts) keeps
 * the projection in sync at the single write site.
 */
export interface RuntimeCourt {
  /** D1 — durable inventory identity (admin-owned catalog record). */
  record: CourtRecord;
  /** D1 — the ONE active flow (null → IDLE). */
  flow: FlowSlot;
  /**
   * Club pre-flow pending-PIN state (RESERVED, Q2) — excludes SELECT.
   * A court can be `reserved` while `flow` is still null (IDLE): the PIN
   * exists, the session has not started.
   */
  reserved: boolean;
  /**
   * Flow-mode ORIENTATION — the court's current mode ('tournament' | 'club').
   *
   * DEVIATION (documented): the design says kind is derived from the active
   * flow and never stored. In practice an IDLE court (flow null) must still
   * render correctly (a reset club court shows as "Disponible" in the club
   * kiosk; a bound-but-not-started tournament court shows in the tournament
   * list). `mode` is therefore a RETAINED orientation that FOLLOWS the flow:
   * it is set at materialization (createClubCourt / materialize / deprecated
   * createCourt) and updated whenever a flow starts (club occupy → 'club',
   * tournament start → 'tournament'). It is NOT a permanent discriminator —
   * kind-mutability holds: a court used for club today and tournament
   * tomorrow keeps ONE courtId; only mode+flow change (INV-2/E11).
   */
  mode: FlowModeKey;
  // ── legacy identity accessors — mirror `record` (invariant:
  //    id === record.courtId, number === record.number, name === record.name,
  //    maintained at construction) so pre-slice-5 consumers and test
  //    fixtures that read `court.id`/`court.name`/`court.number` keep working.
  id: string;
  number: number;
  name: string;
  pin: string;
  sportRules: MatchEngine;
  /** Whether this court is currently featured/spotlight on the kiosk */
  featured: boolean;
  players: PlayerConnection[];
  playerNames: { a: string; b: string };
  createdAt: number;
  history: MatchEvent[];
  // ── legacy projection fields — kept in sync with `flow` (see header) ──
  status: TournamentStatus;
  clubStatus: ClubStatus;
  /** Epoch ms when the court was first occupied (set on RESERVED→OCCUPIED transition) */
  occupiedAt: number | null;
  /** Active session mode — 'free' | 'match'. Null when no active session. */
  sessionMode: SessionMode | null;
  /** Player name snapshot captured at session-start. */
  playerName: string | null;
  /** Phone — AES-256-GCM base64 ciphertext string. */
  phone: string | null;
  /** Admin socket id who started the session (`socket.data.adminId`). */
  adminId: string | null;
  // Event callbacks — internal wiring, never exposed to client
  onTableUpdate?: () => void;
  onMatchEvent?: (event: MatchEvent) => void;
}

/**
 * True when the court is club-oriented (its retained flow-mode orientation is
 * 'club' — see `RuntimeCourt.mode`). Replaces the legacy `isClubCourt` kind
 * guard (slice-5 bridge reversal): orientation follows the flow, so a court
 * with a club flow, a RESERVED pending-PIN court, and an IDLE-but-materialized
 * club court all report club. Tournament courts report false.
 */
export function isClubFlowCourt(court: RuntimeCourt): boolean {
  return court.mode === 'club';
}

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
  /**
   * player-identity (Phase 2 task 2.3) — admin socket id captured at
   * CLUB_VERIFY_ADMIN success. Mirrors the existing `isClubAdmin` pattern:
   * written by ClubAdminHandler on verify, read by other handlers when
   * they need to attribute an admin action (SessionRecord.adminId).
   * `string | null` so the absence of an admin id is representable
   * (player-initiated sessions explicitly set this to null).
   */
  adminId?: string | null;
}
