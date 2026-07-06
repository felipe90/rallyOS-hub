import { ScoreChange, CourtStatus, Score, PadelPoint } from '../../domain/types';
import type { MatchConfig } from '../../domain/types';

/**
 * Serializable match state for persistence.
 * Flat interface (not the discriminated union MatchState) to handle
 * migration from v1 (no sport field) and to keep serialization simple.
 * Excludes runtime fields (tableId, tableName, playerNames, undoAvailable)
 * which live on the PersistedCourt level.
 */
export interface PersistedMatchState {
  config: MatchConfig;
  score: { sets: Score; currentSet: Score; serving: string };
  swappedSides: boolean;
  midSetSwapped: boolean;
  setHistory: Score[];
  status: CourtStatus;
  winner: string | null;
  sport: string;
  history: ScoreChange[];
  /** Padel-specific fields (optional, for backward compat with v2) */
  padelPoints?: { a: PadelPoint; b: PadelPoint };
  isTiebreak?: boolean;
  tiebreakPoints?: { a: number; b: number };
  goldenPoint?: boolean;
}

/**
 * Serializable table snapshot.
 * Excludes runtime-only fields: MatchEngine instances, PlayerConnection.socketId
 * values, and Socket.io callback references.
 */
export interface PersistedCourt {
  id: string;
  number: number;
  name: string;
  status: CourtStatus;
  pin: string;
  playerNames: { a: string; b: string };
  createdAt: number;
  matchState: PersistedMatchState;
  mode?: string;
  clubStatus?: string;
}
/** @deprecated Use PersistedCourt instead */
export type PersistedTable = PersistedCourt;

/**
 * Current persistence schema version.
 * - Version 1: Pre-multi-sport (no sport field in matchState).
 * - Version 2: Multi-sport support (sport field in matchState).
 */
export const PERSISTENCE_VERSION = 2;

/**
 * Top-level persistence wrapper written to disk.
 */
export interface PersistedState {
  version: number;
  savedAt: number;
  tables: PersistedCourt[];
}

/**
 * Adapter interface for export formats (CSV, JSON, etc.).
 * StateStore does NOT implement this — separate adapters do.
 */
export interface MatchExporter {
  export(tables: PersistedCourt[]): string;
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
