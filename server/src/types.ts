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
  TableStatus,
  ScoreChange,
  MatchEventType,
  SetWonEvent,
  MatchWonEvent,
  MatchEvent,
  MatchConfig,
  MatchConfigExtended,
  MatchState,
  MatchStateExtended,
  TableInfo,
  TableInfoWithPin,
  QRData,
  ErrorResponse,
  ValidationError,
} from '../../shared/types';
import type { MatchEngine } from './matchEngine';

// Re-export everything from shared so consumers can still `import { X } from './types'`
export {
  Player,
  Score,
  TableStatus,
  ScoreChange,
  MatchEventType,
  SetWonEvent,
  MatchWonEvent,
  MatchEvent,
  MatchConfig,
  MatchConfigExtended,
  MatchState,
  MatchStateExtended,
  TableInfo,
  TableInfoWithPin,
  QRData,
  ErrorResponse,
  ValidationError,
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
 * Table (internal server-only type)
 *
 * This type adds server-internal fields (callbacks, internal state)
 * that must never be serialized and sent to the client.
 */
export interface Table {
  id: string;
  number: number;
  name: string;
  status: TableStatus;
  pin: string;
  matchEngine: MatchEngine;
  playerNames: { a: string; b: string };
  history: MatchEvent[];
  players: PlayerConnection[];
  createdAt: number;
  // Event callbacks — internal wiring, never exposed to client
  onTableUpdate?: () => void;
  onMatchEvent?: (event: MatchEvent) => void;
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
}
