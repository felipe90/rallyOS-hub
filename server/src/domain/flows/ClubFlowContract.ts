/**
 * ClubFlowContract — club session flow (FMR-3/AFE-3).
 *
 * Full behavior lands in work unit 2 (strict TDD): this is the WU1 skeleton
 * so the registry resolves the mode; states OCCUPIED → FINISHED with a
 * running timer/cost while OCCUPIED, forceEnd finalizes cost + adminId-stamps
 * then releases → IDLE, canArchive false while BUSY.
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

export class ClubFlowContract implements FlowModeContract {
  readonly key = 'club' as const;
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
    // club courts are untouched by tournament releaseAll (TCS-3)
  }
}
