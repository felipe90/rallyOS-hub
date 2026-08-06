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
 * Slice-5 bridge reversal: operates on the single `RuntimeCourt` type — the
 * FLOW slot is authoritative; `status` is the projection field kept in sync
 * (single writer). Clearing the flow → IDLE and the match engine is reset so
 * the court is fresh and re-usable.
 */
import { AVAILABILITY, type Availability } from '../../../../shared/types';
import type { RuntimeCourt } from '../types';
import type {
  FlowModeContract,
  FlowContext,
  FlowCost,
  ForceEndResult,
  PersistedFlowSession,
} from './FlowModeContract';

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
  forceEnd(court: RuntimeCourt, _adminId: string, ctx: FlowContext = {}): ForceEndResult | null {
    if (court.flow?.mode !== 'tournament' || court.flow.state !== 'LIVE') return null;

    const bound = ctx.resolveMatchForCourt?.(court.record.courtId) ?? null;
    if (bound) {
      ctx.unbindMatch?.(bound.id); // assignCourt(matchId, null) — binding only
    }
    this.clearFlow(court);

    return {
      releasedCourtId: court.record.courtId,
      ...(bound ? { unboundMatchId: bound.id } : {}),
    };
  }

  /** Tournament has no per-session cost settle (design: end → null). */
  end(_court: RuntimeCourt, _ctx?: FlowContext): FlowCost | null {
    return null;
  }

  /** Archive guard (INV-5): false while BUSY (LIVE). */
  canArchive(court: RuntimeCourt): boolean {
    return court.flow?.mode !== 'tournament' || court.flow.state !== 'LIVE';
  }

  /**
   * Detach on tournament end/reset (FMR-4, TCS-3 releaseAll). Called AFTER
   * the bracket engine clears every match.courtId binding; this clears the
   * court's live flow → IDLE.
   */
  release(court: RuntimeCourt, _ctx?: FlowContext): void {
    this.clearFlow(court);
  }

  /** Serialize the active flow into the v4 liveSessions row. */
  serialize(court: RuntimeCourt): PersistedFlowSession | null {
    if (court.flow?.mode !== 'tournament' || court.flow.state !== 'LIVE') return null;

    return {
      courtId: court.record.courtId,
      flow: { mode: 'tournament', state: 'LIVE', startedAt: court.flow.startedAt },
      matchState: null,
      // Display identity snapshot (CSV export / restore fallback).
      number: court.record.number,
      name: court.record.name,
      pin: court.pin,
      playerNames: { ...court.playerNames },
      createdAt: court.createdAt,
    };
  }

  /** Clear the flow → IDLE + reset the match engine (court re-usable). */
  private clearFlow(court: RuntimeCourt): void {
    court.flow = null;
    court.status = 'WAITING';
    court.sportRules.reset();
  }
}
