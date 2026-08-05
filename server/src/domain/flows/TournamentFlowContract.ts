/**
 * TournamentFlowContract — tournament court flow (FMR-4/AFE-2).
 *
 * Full behavior lands in work unit 3 (strict TDD): this is the WU1 skeleton
 * so the registry resolves the mode; state LIVE (match running), forceEnd
 * clears the flow AND unbinds match.courtId WITHOUT setWinner/advance,
 * release() serves releaseAll on tournament end/reset (TCS-3).
 */
import { AVAILABILITY, type Availability } from '../../../../shared/types';
import type { Court } from '../types';
import type {
  FlowModeContract,
  FlowContext,
  FlowCost,
  ForceEndResult,
  PersistedFlowSession,
} from './FlowModeContract';

export class TournamentFlowContract implements FlowModeContract {
  readonly key = 'tournament' as const;
  readonly states: readonly string[] = [];
  readonly allowedTransitions: Readonly<Record<string, readonly string[]>> = {};

  availabilityOf(_state: string): Availability {
    return AVAILABILITY.IDLE;
  }

  end(_court: Court, _ctx?: FlowContext): FlowCost | null {
    return null;
  }

  forceEnd(_court: Court, _adminId: string, _ctx?: FlowContext): ForceEndResult | null {
    return null;
  }

  serialize(_court: Court): PersistedFlowSession | null {
    return null;
  }

  canArchive(_court: Court): boolean {
    return true;
  }

  release(_court: Court, _ctx?: FlowContext): void {
    // detach on tournament end/reset (releaseAll, TCS-3)
  }
}
