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
 * BRIDGE NOTE: operates on the legacy `ClubCourt` (slice-2 bridge); re-typed
 * to RuntimeCourt at the conversion (see FlowModeContract.ts header).
 */
import {
  CLUB_STATUS,
  AVAILABILITY,
  SESSION_MODE,
  type Availability,
  type SessionMode,
} from '../../../../shared/types';
import { isClubCourt } from '../types';
import type { Court, ClubCourt } from '../types';
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

function asClubCourt(court: Court): ClubCourt | null {
  return isClubCourt(court) ? court : null;
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
  occupy(court: Court, ctx: FlowContext = {}): boolean {
    const c = asClubCourt(court);
    if (!c || c.clubStatus !== CLUB_STATUS.RESERVED) return false;

    c.clubStatus = CLUB_STATUS.OCCUPIED;
    c.occupiedAt = Date.now();
    if (ctx.sessionMode !== undefined) c.sessionMode = ctx.sessionMode;
    if (typeof ctx.playerName === 'string') c.playerName = ctx.playerName;
    if (typeof ctx.phone === 'string') c.phone = ctx.phone;
    return true;
  }

  /** Set the session mode (free | match) + player identity on an OCCUPIED court. */
  start(court: Court, ctx: FlowContext = {}): boolean {
    const c = asClubCourt(court);
    if (!c || c.clubStatus !== CLUB_STATUS.OCCUPIED) return false;

    if (ctx.sessionMode === SESSION_MODE.FREE || ctx.sessionMode === SESSION_MODE.MATCH) {
      c.sessionMode = ctx.sessionMode;
    }
    // player-identity — populate when provided, PRESERVE otherwise (idempotent
    // re-entry: CLUB_START_FREE / CLUB_NEW_MATCH re-sent without identity).
    if (typeof ctx.playerName === 'string') c.playerName = ctx.playerName;
    if (typeof ctx.phone === 'string') c.phone = ctx.phone;
    return true;
  }

  /**
   * End the session: OCCUPIED → FINISHED, clear the PIN, settle the cost
   * (FMR-3). `cost` = ceil(elapsedMinutes × costPerMinute); 0 for free.
   */
  end(court: Court, ctx: FlowContext = {}): FlowCost | null {
    const c = asClubCourt(court);
    if (!c || c.clubStatus !== CLUB_STATUS.OCCUPIED) return null;

    const now = Date.now();
    const elapsedMs = c.occupiedAt ? now - c.occupiedAt : 0;
    const elapsedMinutes = Math.max(MIN_ELAPSED_MINUTES, Math.ceil(elapsedMs / 60000));
    const elapsedSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
    const cost = Math.ceil(elapsedMinutes * (ctx.costPerMinute ?? 0));
    const currency = ctx.currency ?? DEFAULT_CURRENCY;

    c.clubStatus = CLUB_STATUS.FINISHED;
    c.pin = '';

    return { elapsedMinutes, elapsedSeconds, cost, currency };
  }

  /**
   * Admin stop control (AFE-3): adminId-stamp (when provided) then finalize
   * cost + release → IDLE. Mirrors CLUB_FORCE_END cost semantics.
   */
  forceEnd(court: Court, adminId: string, ctx: FlowContext = {}): ForceEndResult | null {
    const c = asClubCourt(court);
    if (!c || c.clubStatus !== CLUB_STATUS.OCCUPIED) return null;

    // Traceability: stamp BEFORE the release so the onClubSessionEnd callback
    // (which reads court.adminId) attributes the force-ender, not the starter.
    if (typeof adminId === 'string' && adminId.length > 0) {
      c.adminId = adminId;
    }

    const settled = this.end(c, ctx);
    if (!settled) return null;

    return {
      releasedCourtId: c.id,
      elapsedMinutes: settled.elapsedMinutes,
      elapsedSeconds: settled.elapsedSeconds,
      cost: settled.cost,
      currency: settled.currency,
    };
  }

  /** Serialize the active flow into the target v4 liveSessions row. */
  serialize(court: Court): PersistedFlowSession | null {
    const c = asClubCourt(court);
    if (!c) return null;
    if (c.clubStatus !== CLUB_STATUS.OCCUPIED && c.clubStatus !== CLUB_STATUS.FINISHED) return null;

    return {
      courtId: c.id,
      flow: {
        mode: 'club',
        state: c.clubStatus === CLUB_STATUS.OCCUPIED ? 'OCCUPIED' : 'FINISHED',
        sessionMode: c.sessionMode as SessionMode | null,
        occupiedAt: c.occupiedAt,
        playerName: c.playerName,
        phone: c.phone,
        adminId: c.adminId,
      },
      matchState: null,
    };
  }

  /** Archive guard (INV-5): false while BUSY (OCCUPIED). */
  canArchive(court: Court): boolean {
    return this.availabilityOf(asClubCourt(court)?.clubStatus ?? '') !== AVAILABILITY.BUSY;
  }

  /** No-op — club courts are untouched by tournament releaseAll (TCS-3). */
  release(_court: Court, _ctx?: FlowContext): void {
    // club flows have no bracket-scoped release; reset/end are explicit actions
  }
}
