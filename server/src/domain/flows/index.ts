/**
 * flows/index.ts — default flow registration + public surface.
 *
 * `registerDefaultFlows()` builds the rule-engine registry with the two
 * built-in modes (club, tournament). A future mode (`clase`) registers ONE
 * more contract here — CourtManager is untouched (FMR-1 scenario).
 */
import { FlowModeRegistry } from './FlowModeRegistry';
import { ClubFlowContract } from './ClubFlowContract';
import { TournamentFlowContract } from './TournamentFlowContract';

export * from './FlowModeContract';
export * from './FlowModeRegistry';
export { ClubFlowContract } from './ClubFlowContract';
export { TournamentFlowContract } from './TournamentFlowContract';

/** Build the registry with the default club + tournament contracts. */
export function registerDefaultFlows(): FlowModeRegistry {
  return new FlowModeRegistry()
    .register('club', () => new ClubFlowContract())
    .register('tournament', () => new TournamentFlowContract());
}
