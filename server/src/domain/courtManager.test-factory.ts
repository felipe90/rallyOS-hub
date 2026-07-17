/**
 * CourtManager Test Factory
 *
 * Creates a fully-wired CourtManager with sensible defaults for testing.
 * Tests can override individual dependencies via the `overrides` parameter.
 *
 * Usage:
 *   import { createTestCourtManager } from './courtManager.test-factory';
 *   const cm = createTestCourtManager();
 *   const cmWithPersistence = createTestCourtManager({ persistence: stateStore });
 *   const cmWithMock = createTestCourtManager({ repository: mockRepo });
 */

import { CourtManager, CourtManagerDeps } from './courtManager';
import { HubConfig } from './types';
import { CourtRepository } from '../services/table/CourtRepository';
import { PlayerService } from '../services/table/PlayerService';
import { MatchOrchestrator } from '../services/table/MatchOrchestrator';
import { CourtFormatter } from '../services/table/CourtFormatter';
import { PinService } from '../services/security/PinService';
import { QRService } from '../services/qr/QRService';

/** Default hub config used when none is provided */
export const TEST_HUB_CONFIG: HubConfig = {
  ssid: 'test-ssid',
  ip: '127.0.0.1',
  port: 3000,
  domain: 'test.local',
  wifiPassword: 'test-password',
};

/**
 * Create a CourtManager with sensible defaults for testing.
 *
 * @param overrides - Optional partial deps to override defaults.
 *   Also accepts `hubConfig` for convenience (needed by QRService default).
 *   When `playerService` is not provided but `pinService` is overridden,
 *   the default playerService will use the overridden pinService.
 * @returns A fully-wired CourtManager instance.
 */
export function createTestCourtManager(
  overrides?: Partial<CourtManagerDeps> & { hubConfig?: HubConfig },
): CourtManager {
  const hubConfig = overrides?.hubConfig ?? TEST_HUB_CONFIG;
  const pinService = overrides?.pinService ?? new PinService();

  const deps: CourtManagerDeps = {
    repository: overrides?.repository ?? new CourtRepository(),
    pinService,
    playerService: overrides?.playerService ?? new PlayerService(pinService),
    matchOrchestrator: overrides?.matchOrchestrator ?? new MatchOrchestrator(),
    formatter: overrides?.formatter ?? new CourtFormatter(),
    qrService: overrides?.qrService ?? new QRService(hubConfig),
    persistence: overrides?.persistence,
  };

  return new CourtManager(deps);
}
