/**
 * FlowModeContract — the per-mode flow rule engine (FMR-1/FMR-2).
 *
 * Each flow mode (club, tournament, future 'clase') registers ONE contract
 * that fully specifies that mode's behavior: its states + allowed transitions,
 * how a flow state maps to availability, and the lifecycle actions
 * (occupy/start/end→cost/forceEnd/serialize/canArchive/release). CourtManager
 * ONLY drives the registry — it never branches on `sessionMode` inline
 * (the enum+switch anti-pattern this engine removes, design §8).
 *
 * Slice-5 bridge reversal: the contract methods are typed against the single
 * `RuntimeCourt` type (the legacy `Court` union is removed — see
 * apply-progress). The contract surface is unchanged (INV-2, E11).
 */

import {
  INVENTORY_STATUS,
  AVAILABILITY,
  type Availability,
  type CourtRecord,
  type BracketMatch,
  type SessionMode,
} from '../../../../shared/types';
import type { FlowModeKey, FlowSlot, RuntimeCourt } from '../types';
import type { PersistedFlowSession } from '../ports/persistence-types';
export type { PersistedFlowSession };

/**
 * Settled session result of `end()` (FMR-3/AFE-3 — club flow).
 * `cost` = Math.ceil(elapsedMinutes × costPerMinute); 0 for free/tournament.
 * Tournament `end()` returns null — tournament has no per-session cost settle.
 */
export interface FlowCost {
  elapsedMinutes: number;
  elapsedSeconds: number;
  cost: number;
  currency: string;
}

/**
 * Admin force-end result (AFE-1/2/3).
 * - club: cost finalized (settled) and the court released → IDLE.
 * - tournament: `unboundMatchId` set when a bracket match was bound to the
 *   court — the binding is cleared (assignCourt(m, null)) WITHOUT setWinner
 *   or advance (AFE-2).
 */
export interface ForceEndResult {
  releasedCourtId: string;
  /** tournament only — bracket match whose courtId was unbound (AFE-2). */
  unboundMatchId?: string;
  /** club only — settled session fields (AFE-3). */
  elapsedMinutes?: number;
  elapsedSeconds?: number;
  cost?: number;
  currency?: string;
}

/**
 * Caller-supplied environment a contract needs to execute an action.
 * Contracts are pure flow-state machines: everything they depend on that is
 * NOT on the court object arrives via this context (no I/O, no globals).
 */
export interface FlowContext {
  /** ClubConfig.costPerMinute — club cost settle; default 0. */
  costPerMinute?: number;
  /** ClubConfig.currency — default 'ARS'. */
  currency?: string;
  /** Club `start` — session mode to set (free | match). */
  sessionMode?: SessionMode;
  /** Club `start` — player identity to capture (player flow). */
  playerName?: string;
  /** Club `start` — encrypted phone to capture (player flow). */
  phone?: string;
  /** Tournament — resolve the bracket match currently bound to a court. */
  resolveMatchForCourt?: (courtId: string) => { id: string } | null;
  /** Tournament — unbind a bracket match from its court (assignCourt(m, null)). */
  unbindMatch?: (matchId: string) => void;
}

/**
 * The flow contract surface (FMR-2). One instance per mode.
 */
export interface FlowModeContract {
  readonly key: FlowModeKey;
  readonly states: readonly string[];
  readonly allowedTransitions: Readonly<Record<string, readonly string[]>>;
  /** Map a flow state → availability (OCCUPIED/LIVE → BUSY, else IDLE). */
  availabilityOf(state: string): Availability;
  /** Occupy a court (club: RESERVED → OCCUPIED). Tournament has no occupy. */
  occupy?(court: RuntimeCourt, ctx?: FlowContext): boolean;
  /** Start the flow on an occupied court (club: set session mode + identity). */
  start?(court: RuntimeCourt, ctx?: FlowContext): boolean;
  /** End the flow → settled cost (club) or null (tournament). */
  end(court: RuntimeCourt, ctx?: FlowContext): FlowCost | null;
  /** Admin stop control — finalize + release → IDLE (AFE-1). */
  forceEnd(court: RuntimeCourt, adminId: string, ctx?: FlowContext): ForceEndResult | null;
  /** Serialize the active flow into the liveSessions row (v4 shape). */
  serialize(court: RuntimeCourt): PersistedFlowSession | null;
  /** Archive guard — false while the court is BUSY (INV-5/R7). */
  canArchive(court: RuntimeCourt): boolean;
  /** Detach the flow on tournament end/reset (releaseAll, TCS-3). */
  release(court: RuntimeCourt, ctx?: FlowContext): void;
}

/**
 * availabilityOf — the DERIVED availability axis (INV-4/E12).
 *
 * Pure function over (inventoryStatus, active flow, bracket binding) →
 * IDLE | BUSY. NEVER persisted — consistent by construction, cannot drift.
 *
 *   - non-ACTIVE inventory (MAINTENANCE/ARCHIVED) is excluded from the
 *     usable pool → IDLE (usable = ACTIVE && IDLE)
 *   - an active flow (club OCCUPIED / tournament LIVE) → BUSY
 *   - a bound bracket match (tournament live assignment) → BUSY
 *   - otherwise → IDLE
 */
export function availabilityOf(
  record: CourtRecord,
  flow: FlowSlot,
  binding: BracketMatch | null,
): Availability {
  if (record.inventoryStatus !== INVENTORY_STATUS.ACTIVE) return AVAILABILITY.IDLE;
  if (flow) return AVAILABILITY.BUSY;
  if (binding) return AVAILABILITY.BUSY;
  return AVAILABILITY.IDLE;
}
