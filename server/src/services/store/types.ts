import { MatchState, ScoreChange, TableStatus } from '../../domain/types';

/**
 * Serializable match state for persistence.
 * Extends MatchState with undo history — excludes runtime fields
 * (tableId, tableName, playerNames, undoAvailable) which live on the
 * PersistedTable level.
 */
export interface PersistedMatchState extends MatchState {
  history: ScoreChange[];
}

/**
 * Serializable table snapshot.
 * Excludes runtime-only fields: MatchEngine instances, PlayerConnection.socketId
 * values, and Socket.io callback references.
 */
export interface PersistedTable {
  id: string;
  number: number;
  name: string;
  status: TableStatus;
  pin: string;
  playerNames: { a: string; b: string };
  createdAt: number;
  matchState: PersistedMatchState;
}

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
  tables: PersistedTable[];
}

/**
 * Adapter interface for export formats (CSV, JSON, etc.).
 * StateStore does NOT implement this — separate adapters do.
 */
export interface MatchExporter {
  export(tables: PersistedTable[]): string;
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
