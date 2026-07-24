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
import type { MatchConfig, SessionMode } from '../../../../shared/types';

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
 * Top-level persistence container written to disk.
 * Defines the shape of the full state file for the ICourtPersistence contract.
 */
export interface PersistedStateV3 {
  version: number;
  savedAt: number;
  tournamentCourts: PersistedCourt[];
  clubCourts: PersistedClubCourt[];
}

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
