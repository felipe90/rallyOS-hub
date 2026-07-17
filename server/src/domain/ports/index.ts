/**
 * Domain Ports — barrel export.
 *
 * The domain/ports/ directory defines interfaces that the domain layer
 * depends ON but does NOT implement. Concrete implementations live in
 * services/ and are injected at the composition root (index.ts).
 *
 * This follows Dependency Inversion: high-level domain policy depends on
 * abstractions (ports), not low-level implementation details (adapters).
 *
 * Following the SportRules pattern in domain/sports/types.ts:
 * each port is a single-interface file; the barrel consolidates exports.
 */

export type { IPinService } from './IPinService';
export type { IQRService } from './IQRService';
export type { ICourtFormatter } from './ICourtFormatter';
export type { ICourtRepository } from './ICourtRepository';
export type { ICourtPersistence } from './ICourtPersistence';
export type { IClubConfigRepository } from './IClubConfigRepository';
export type { IPlayerService } from './IPlayerService';
export type { IMatchEngineFactory } from './IMatchEngineFactory';
export { DefaultMatchEngineFactory } from './IMatchEngineFactory';
export type { IMatchOrchestrator } from './IMatchOrchestrator';
export {
  isMatchActive,
  setMatchStatus,
} from './match-guards';
export type {
  PersistedCourt,
  PersistedClubCourt,
  PersistedMatchState,
  PersistedTable,
  PersistedStateV3,
  FileSystem,
  MatchExporter,
} from './persistence-types';
