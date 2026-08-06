/**
 * Persistence Types — domain-level serialization contracts.
 *
 * These types define the shape of persisted data, decoupling the
 * storage layer from the domain. They are consumed by store adapters,
 * exporters, and load/restore logic in the domain layer.
 *
 * Moved from services/store/types.ts as part of domain-ports-decoupling
 * to enforce Dependency Inversion: domain owns the persistence contract,
 * store implementations satisfy it.
 */

import { ScoreChange, TournamentStatus } from '../../../../shared/types';
import type { MatchConfig, SessionMode, TournamentBracket } from '../../../../shared/types';
import type { FlowSlot } from '../types';

/**
 * Serializable match state for persistence.
 * Flat interface (not the discriminated union MatchState) to handle
 * migration from v1 (no sport field) and to keep serialization simple.
 * Excludes runtime fields (tableId, tableName, playerNames, undoAvailable)
 * which live on the PersistedCourt level.
 */
export interface PersistedMatchState {
  config: MatchConfig;
  score: { sets: { a: number; b: number }; currentSet: { a: number; b: number }; serving: string };
  swappedSides: boolean;
  midSetSwapped: boolean;
  setHistory: { a: number; b: number }[];
  status: TournamentStatus;
  winner: string | null;
  sport: string;
  history: ScoreChange[];
  /** Padel-specific fields (optional, for backward compat with v2) */
  padelPoints?: { a: number; b: number };
  isTiebreak?: boolean;
  tiebreakPoints?: { a: number; b: number };
  goldenPoint?: boolean;
}

/**
 * Serializable tournament table snapshot.
 * Excludes runtime-only fields: MatchEngine instances, PlayerConnection.socketId
 * values, and Socket.io callback references.
 * Does NOT contain club-specific fields (clubStatus, occupiedAt, mode).
 *
 * NOTE (admin-court-inventory slice 5): PersistedCourt/PersistedClubCourt are
 * the LEGACY v3 row shapes. The v4 file carries `liveSessions:
 * PersistedFlowSession[]` instead — these types remain for the
 * CsvExporter/MatchExporter surface and legacy-restore compatibility.
 */
export interface PersistedCourt {
  id: string;
  number: number;
  name: string;
  status: TournamentStatus;
  pin: string;
  playerNames: { a: string; b: string };
  createdAt: number;
  matchState: PersistedMatchState;
}

/** @deprecated Use PersistedCourt instead */
export type PersistedTable = PersistedCourt;

/**
 * Serializable club court snapshot.
 * Contains club-specific fields (clubStatus, occupiedAt) and no tournament
 * fields (status). matchState is nullable because club courts may be saved
 * before a match starts (AVAILABLE/RESERVED state).
 */
export interface PersistedClubCourt {
  id: string;
  number: number;
  name: string;
  kind?: 'club';
  clubStatus: string;
  /** Epoch ms when the court was first occupied — null when not occupied */
  occupiedAt: number | null;
  pin: string;
  playerNames: { a: string; b: string };
  createdAt: number;
  matchState: PersistedMatchState | null;
  config: Record<string, unknown> | null;
  history: Record<string, unknown>[];
  /**
   * PR 2 — persisted session mode for the club court.
   * Optional so that legacy v3 files (written before this field existed)
   * still parse cleanly; restoreState falls back to `null` when absent.
   */
  sessionMode?: SessionMode | null;
  /**
   * player-identity — persisted player name snapshot captured at session
   * start (see `player-identity` spec — session-record MODIFIED).
   * Optional so legacy v3 files (pre-change) still parse cleanly; load
   * falls back to `null` when absent.
   */
  playerName?: string | null;
  /**
   * player-identity — persisted phone ciphertext (AES-256-GCM base64
   * `{nonce}:{ciphertext}:{authTag}`). Optional for legacy v3 compat.
   */
  phone?: string | null;
  /**
   * player-identity — persisted adminId (admin socket id, or null for
   * player-initiated sessions). Optional for legacy v3 compat.
   */
  adminId?: string | null;
}

/**
 * Adapter interface for export formats (CSV, JSON, etc.).
 * StateStore does NOT implement this — separate adapters do.
 */
export interface MatchExporter {
  export(tables: PersistedCourt[]): string;
}

/**
 * PersistedFlowSession — the transient flow row of the v4 `liveSessions`
 * shape (PERS-2, admin-court-inventory). Produced by the flow contracts'
 * `serialize()`; consumed by StateStore.save/load and CourtManager
 * persist/restore. Only LIVE/OCCUPIED/FINISHED flows are persisted —
 * IDLE (flow null) courts are never written.
 */
export interface PersistedFlowSession {
  /** Stable inventory identity (CourtRecord.courtId). */
  courtId: string;
  /** The transient flow (tournament LIVE | club OCCUPIED/FINISHED). */
  flow: FlowSlot;
  /** Serializable match state (null for flows without a started match). */
  matchState: unknown | null;
  /** Display identity snapshot (CSV export / restore fallback). */
  number?: number;
  name?: string;
  pin?: string;
  playerNames?: { a: string; b: string };
  createdAt?: number;
}

/**
 * Top-level persistence container written to disk (v4, PERS-1/PERS-2).
 * The v3 `tournamentCourts[]`/`clubCourts[]` arrays are DROPPED (slice-5
 * bridge reversal): the v4 file carries the transient `liveSessions` rows
 * only. The durable admin catalog lives in `data/court-inventory.json`
 * (CourtInventoryStore).
 */
export interface PersistedStateV4 {
  version: number;
  savedAt: number;
  /** Transient LIVE sessions only (tournament LIVE; club OCCUPIED/FINISHED). */
  liveSessions: PersistedFlowSession[];
  /**
   * Tournament bracket snapshot (spec: bracket-tournament-mvp R10).
   * OPTIONAL so files written before this field existed still parse
   * cleanly. `null` represents an explicitly-cleared bracket. Absent
   * (undefined) on legacy files and is treated as `null` on load.
   */
  bracket?: TournamentBracket | null;
}

/** @deprecated v3 container shape — replaced by PersistedStateV4. */
export interface PersistedStateV3 {
  version: number;
  savedAt: number;
  tournamentCourts: PersistedCourt[];
  clubCourts: PersistedClubCourt[];
  bracket?: TournamentBracket | null;
}

/**
 * Current persistence schema version.
 * - Version 1: Pre-multi-sport (no sport field in matchState).
 * - Version 2: Multi-sport support (sport field in matchState).
 * - Version 3: Split tournamentCourts[] and clubCourts[] arrays.
 * - Version 4 (admin-court-inventory, PERS-1): persistence WIPE. `load()`
 *   discards any file whose version !== 4 (no v3→v4 data migration — one-way
 *   door, never ship after commercial launch). The v1→v2→v3 migration chain
 *   is removed. The v4 document carries the transient `liveSessions[]`
 *   (PersistedFlowSession) rows ONLY — the legacy tournamentCourts[]/
 *   clubCourts[] arrays are dropped (slice-5 bridge reversal; PERS-2).
 *
 * Owned by the domain persistence contract (DIP); the storage layer
 * re-exports it for backward compatibility.
 */
export const PERSISTENCE_VERSION = 4;

/**
 * Minimal filesystem abstraction for dependency injection.
 * Enables unit testing without jest.mock (avoids Jest 30 compat issues).
 */
export interface FileSystem {
  writeFileSync(path: string, data: string, encoding: BufferEncoding): void;
  readFileSync(path: string, encoding: BufferEncoding): string;
  renameSync(oldPath: string, newPath: string): void;
  existsSync(path: string): boolean;
  unlinkSync(path: string): void;
  mkdirSync(path: string, options?: { recursive: boolean }): string | undefined;
}

