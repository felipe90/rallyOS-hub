/**
 * TournamentFlowContract — tournament court flow rule engine (FMR-4, AFE-2).
 *
 * State LIVE (a bracket match is running on the court).
 *   - `forceEnd`  clears the flow AND unbinds the bracket match
 *     (`assignCourt(matchId, null)` via ctx) — NO setWinner, NO advance
 *     (AFE-2, D9). The match RESULT data is untouched; only the binding is
 *     cleared so the court reaches IDLE.
 *   - `release`   detach on tournament end/reset (releaseAll, TCS-3) — the
 *     bracket engine clears every match.courtId first, then calls release()
 *     per affected court (FMR-4).
 *   - `end`       returns null — tournament has no per-session cost settle.
 *   - `canArchive` false while BUSY (INV-5/R7).
 *
 * BRIDGE NOTE: operates on the legacy `TournamentCourt` (slice-2 bridge); the
 * "flow" is `status` — clearing it transitions LIVE → WAITING and resets the
 * match engine so the court is fresh and re-usable. Re-typed to RuntimeCourt
 * at the conversion (see FlowModeContract.ts header).
 */
import { AVAILABILITY, type Availability } from '../../../../shared/types';
import { isTournamentCourt } from '../types';
import type { Court, TournamentCourt } from '../types';
import type {
  FlowModeContract,
  FlowContext,
  FlowCost,
  ForceEndResult,
  PersistedFlowSession,
} from './FlowModeContract';

function asTournamentCourt(court: Court): TournamentCourt | null {
  return isTournamentCourt(court) ? court : null;
}

export class TournamentFlowContract implements FlowModeContract {
  readonly key = 'tournament' as const;
  readonly states: readonly string[] = ['LIVE'];
  readonly allowedTransitions: Readonly<Record<string, readonly string[]>> = {
    LIVE: [], // exits are forceEnd (admin stop) and release (tournament end/reset)
  };

  availabilityOf(state: string): Availability {
    return state === 'LIVE' ? AVAILABILITY.BUSY : AVAILABILITY.IDLE;
  }

  /**
   * Admin stop control (AFE-2/D9): unbind the bound bracket match (binding
   * cleared → court freed) and clear the live flow → IDLE. NEVER calls
   * setWinner and NEVER advances the bracket — match result data untouched.
   */
  forceEnd(court: Court, _adminId: string, ctx: FlowContext = {}): ForceEndResult | null {
    const c = asTournamentCourt(court);
    if (!c || c.status !== 'LIVE') return null;

    const bound = ctx.resolveMatchForCourt?.(c.id) ?? null;
    if (bound) {
      ctx.unbindMatch?.(bound.id); // assignCourt(matchId, null) — binding only
    }
    this.clearFlow(c);

    return {
      releasedCourtId: c.id,
      ...(bound ? { unboundMatchId: bound.id } : {}),
    };
  }

  /** Tournament has no per-session cost settle (design: end → null). */
  end(_court: Court, _ctx?: FlowContext): FlowCost | null {
    return null;
  }

  /** Archive guard (INV-5): false while BUSY (LIVE). */
  canArchive(court: Court): boolean {
    return this.availabilityOf(asTournamentCourt(court)?.status ?? '') !== AVAILABILITY.BUSY;
  }

  /**
   * Detach on tournament end/reset (FMR-4, TCS-3 releaseAll). Called AFTER
   * the bracket engine clears every match.courtId binding; this clears the
   * court's live flow → IDLE.
   */
  release(court: Court, _ctx?: FlowContext): void {
    const c = asTournamentCourt(court);
    if (!c) return;
    this.clearFlow(c);
  }

  /** Serialize the active flow into the target v4 liveSessions row. */
  serialize(court: Court): PersistedFlowSession | null {
    const c = asTournamentCourt(court);
    if (!c || c.status !== 'LIVE') return null;

    return {
      courtId: c.id,
      flow: { mode: 'tournament', state: 'LIVE', startedAt: Date.now() },
      matchState: null,
    };
  }

  /** Bridge flow-clearing: LIVE → WAITING + fresh match engine (court re-usable). */
  private clearFlow(c: TournamentCourt): void {
    c.status = 'WAITING';
    c.sportRules.reset();
  }
}
