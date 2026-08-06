/**
 * ClubFlowContract — club session flow rule engine (FMR-3, AFE-3).
 *
 * States OCCUPIED → FINISHED. The timer/cost runs while OCCUPIED:
 *   - `occupy`   RESERVED → OCCUPIED (timer starts, identity captured)
 *   - `start`    set the session mode (free | match) + player identity
 *   - `end`      OCCUPIED → FINISHED; cost = ceil(elapsedMinutes × costPerMinute)
 *                is SETTLED (FMR-3)
 *   - `forceEnd` adminId-stamps then finalizes cost and releases → IDLE
 *                (AFE-3, mirrors CLUB_FORCE_END cost semantics)
 *   - `canArchive` false while BUSY (INV-5/R7)
 *   - `release`  no-op — club courts are untouched by tournament releaseAll
 *                (TCS-3)
 *
 * Slice-5 bridge reversal: operates on the single `RuntimeCourt` type — the
 * FLOW slot is authoritative and the `clubStatus`/`sessionMode`/identity
 * projection fields are written at the same site (single writer, no drift).
 */
import {
  CLUB_STATUS,
  AVAILABILITY,
  SESSION_MODE,
  type Availability,
  type SessionMode,
} from '../../../../shared/types';
import type { RuntimeCourt } from '../types';
import type {
  FlowModeContract,
  FlowContext,
  FlowCost,
  ForceEndResult,
  PersistedFlowSession,
} from './FlowModeContract';

/** Minimum billable minute (matches club-session-history spec: ceiling, min 1). */
const MIN_ELAPSED_MINUTES = 1;
const DEFAULT_CURRENCY = 'ARS';

/** The club flow slot of a runtime court — null when not in a club flow. */
function clubFlow(court: RuntimeCourt) {
  return court.flow?.mode === 'club' ? court.flow : null;
}

export class ClubFlowContract implements FlowModeContract {
  readonly key = 'club' as const;
  readonly states: readonly string[] = ['OCCUPIED', 'FINISHED'];
  readonly allowedTransitions: Readonly<Record<string, readonly string[]>> = {
    OCCUPIED: ['FINISHED'],
  };

  availabilityOf(state: string): Availability {
    return state === CLUB_STATUS.OCCUPIED ? AVAILABILITY.BUSY : AVAILABILITY.IDLE;
  }

  /** RESERVED → OCCUPIED: start the session timer and capture identity. */
  occupy(court: RuntimeCourt, ctx: FlowContext = {}): boolean {
    if (court.flow !== null || !court.reserved) return false;

    court.flow = {
      mode: 'club',
      state: 'OCCUPIED',
      sessionMode: ctx.sessionMode ?? null,
      occupiedAt: Date.now(),
      playerName: typeof ctx.playerName === 'string' ? ctx.playerName : null,
      phone: typeof ctx.phone === 'string' ? ctx.phone : null,
      adminId: null,
    };
    // Projection (single writer)
    court.mode = 'club';
    court.reserved = false;
    court.clubStatus = CLUB_STATUS.OCCUPIED;
    court.occupiedAt = court.flow.occupiedAt;
    if (ctx.sessionMode !== undefined) court.sessionMode = ctx.sessionMode;
    if (typeof ctx.playerName === 'string') court.playerName = ctx.playerName;
    if (typeof ctx.phone === 'string') court.phone = ctx.phone;
    return true;
  }

  /** Set the session mode (free | match) + player identity on an OCCUPIED court. */
  start(court: RuntimeCourt, ctx: FlowContext = {}): boolean {
    const flow = clubFlow(court);
    if (!flow || flow.state !== 'OCCUPIED') return false;

    if (ctx.sessionMode === SESSION_MODE.FREE || ctx.sessionMode === SESSION_MODE.MATCH) {
      flow.sessionMode = ctx.sessionMode;
      court.sessionMode = ctx.sessionMode;
    }
    // player-identity — populate when provided, PRESERVE otherwise (idempotent
    // re-entry: CLUB_START_FREE / CLUB_NEW_MATCH re-sent without identity).
    if (typeof ctx.playerName === 'string') {
      flow.playerName = ctx.playerName;
      court.playerName = ctx.playerName;
    }
    if (typeof ctx.phone === 'string') {
      flow.phone = ctx.phone;
      court.phone = ctx.phone;
    }
    return true;
  }

  /**
   * End the session: OCCUPIED → FINISHED, clear the PIN, settle the cost
   * (FMR-3). `cost` = ceil(elapsedMinutes × costPerMinute); 0 for free.
   * `ctx.now` overrides the wall clock (deterministic test seam); otherwise
   * the current Date.now() is used.
   */
  end(court: RuntimeCourt, ctx: FlowContext = {}): FlowCost | null {
    const flow = clubFlow(court);
    if (!flow || flow.state !== 'OCCUPIED') return null;

    const now = ctx.now ?? Date.now();
    const elapsedMs = flow.occupiedAt ? now - flow.occupiedAt : 0;
    const elapsedMinutes = Math.max(MIN_ELAPSED_MINUTES, Math.ceil(elapsedMs / 60000));
    const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
    const cost = Math.ceil(elapsedMinutes * (ctx.costPerMinute ?? 0));
    const currency = ctx.currency ?? DEFAULT_CURRENCY;

    flow.state = 'FINISHED';
    court.clubStatus = CLUB_STATUS.FINISHED;
    court.pin = '';

    return { elapsedMinutes, elapsedSeconds, cost, currency };
  }

  /**
   * Admin stop control (AFE-3): adminId-stamp (when provided) then finalize
   * cost + release → IDLE. Mirrors CLUB_FORCE_END cost semantics.
   */
  forceEnd(court: RuntimeCourt, adminId: string, ctx: FlowContext = {}): ForceEndResult | null {
    const flow = clubFlow(court);
    if (!flow || flow.state !== 'OCCUPIED') return null;

    // Traceability: stamp BEFORE the release so the onClubSessionEnd callback
    // (which reads court.adminId) attributes the force-ender, not the starter.
    if (typeof adminId === 'string' && adminId.length > 0) {
      flow.adminId = adminId;
      court.adminId = adminId;
    }

    const settled = this.end(court, ctx);
    if (!settled) return null;

    return {
      releasedCourtId: court.record.courtId,
      elapsedMinutes: settled.elapsedMinutes,
      elapsedSeconds: settled.elapsedSeconds,
      cost: settled.cost,
      currency: settled.currency,
    };
  }

  /** Serialize the active flow into the v4 liveSessions row. */
  serialize(court: RuntimeCourt): PersistedFlowSession | null {
    const flow = clubFlow(court);
    if (!flow) return null;
    if (flow.state !== 'OCCUPIED' && flow.state !== 'FINISHED') return null;

    return {
      courtId: court.record.courtId,
      flow: {
        mode: 'club',
        state: flow.state,
        sessionMode: flow.sessionMode,
        occupiedAt: flow.occupiedAt,
        playerName: flow.playerName,
        phone: flow.phone,
        adminId: flow.adminId,
      },
      matchState: null,
      // Display identity snapshot (CSV export / restore fallback).
      number: court.record.number,
      name: court.record.name,
      pin: court.pin,
      playerNames: { ...court.playerNames },
      createdAt: court.createdAt,
    };
  }

  /** Archive guard (INV-5): false while BUSY (OCCUPIED). */
  canArchive(court: RuntimeCourt): boolean {
    const flow = clubFlow(court);
    return flow?.state !== CLUB_STATUS.OCCUPIED;
  }

  /** No-op — club courts are untouched by tournament releaseAll (TCS-3). */
  release(_court: RuntimeCourt, _ctx?: FlowContext): void {
    // club flows have no bracket-scoped release; reset/end are explicit actions
  }
}
