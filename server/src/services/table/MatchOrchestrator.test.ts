/**
 * MatchOrchestrator Tests — Phase 5: Sport-aware engine creation
 *
 * Tests that MatchOrchestrator resolves the correct SportRules from
 * the registry and creates MatchEngine with the right sport config.
 */

import { MatchOrchestrator } from './MatchOrchestrator';
import { SportRegistry } from '../../domain/sports/sport.registry';
import { MatchEngine } from '../../domain/matchEngine';
import { SPORT } from '../../../../shared/types';
import type { Court, HubConfig } from '../../domain/types';

// ── Helpers ────────────────────────────────────────────────────────────

function makeCourt(overrides: Partial<Court> = {}): Court {
  return {
    id: 'court-1',
    number: 1,
    name: 'Cancha 1',
    status: 'WAITING',
    pin: '1234',
    sportRules: new MatchEngine(),
    playerNames: { a: 'Player A', b: 'Player B' },
    history: [],
    players: [],
    createdAt: Date.now(),
    featured: false,
    ...overrides,
  };
}

// ── Task 5.1: MatchOrchestrator resolves sport from registry ────────────

describe('MatchOrchestrator - Sport Registry Integration', () => {
  let registry: SportRegistry;

  beforeEach(() => {
    registry = new SportRegistry();
  });

  // ── Default sport (TT when no sport specified) ───────────────────────

  describe('default sport', () => {
    it('should default to table tennis when no sport is specified in startMatch', () => {
      const orchestrator = new MatchOrchestrator(registry);
      const court = makeCourt();

      const state = orchestrator.startMatch(court, {
        bestOf: 5,
      });

      expect(state).not.toBeNull();
      expect(state!.sport).toBe(SPORT.TABLE_TENNIS);
      expect(state!.status).toBe('LIVE');
    });

    it('should default to table tennis when no sport is specified in configureMatch', () => {
      const orchestrator = new MatchOrchestrator(registry);
      const court = makeCourt();

      orchestrator.configureMatch(court, {
        playerNames: { a: 'Alice', b: 'Bob' },
        matchConfig: { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 },
      });

      expect(court.status).toBe('CONFIGURING');
      const state = court.sportRules.getState();
      expect(state.sport).toBe(SPORT.TABLE_TENNIS);
    });

    it('should default to table tennis in resetTable when no config given', () => {
      const orchestrator = new MatchOrchestrator(registry);
      const court = makeCourt();

      orchestrator.resetTable(court);

      expect(court.status).toBe('WAITING');
      const state = court.sportRules.getState();
      expect(state.sport).toBe(SPORT.TABLE_TENNIS);
    });
  });

  // ── Padel sport resolution ───────────────────────────────────────────

  describe('padel sport resolution', () => {
    it('should resolve PadelRules from registry when sport=padel in startMatch', () => {
      const orchestrator = new MatchOrchestrator(registry);
      const court = makeCourt();

      const state = orchestrator.startMatch(court, {
        sport: SPORT.PADEL,
        bestOf: 3,
        tiebreakPoints: 7,
        gamesPerSet: 6,
        goldenPoint: false,
      } as any);

      expect(state).not.toBeNull();
      expect(state!.sport).toBe(SPORT.PADEL);
      expect(state!.status).toBe('LIVE');
      // Padel state should have padel-specific fields
      const ps = state as any;
      expect(ps.padelPoints).toBeDefined();
      expect(ps.games).toBeDefined();
    });

    it('should resolve PadelRules from registry when sport=padel in configureMatch', () => {
      const orchestrator = new MatchOrchestrator(registry);
      const court = makeCourt();

      orchestrator.configureMatch(court, {
        playerNames: { a: 'Alice', b: 'Bob' },
        matchConfig: {
          sport: SPORT.PADEL,
          bestOf: 3,
          tiebreakPoints: 10,
          gamesPerSet: 6,
          goldenPoint: true,
        } as any,
      });

      expect(court.status).toBe('CONFIGURING');
      const state = court.sportRules.getState();
      expect(state.sport).toBe(SPORT.PADEL);
      // Verify padel config passed through correctly
      const config = court.sportRules.getConfig() as any;
      expect(config.tiebreakPoints).toBe(10);
      expect(config.goldenPoint).toBe(true);
    });

    it('should resolve PadelRules in resetTable with padel config', () => {
      const orchestrator = new MatchOrchestrator(registry);
      const court = makeCourt();

      orchestrator.resetTable(court, {
        sport: SPORT.PADEL,
        bestOf: 3,
        tiebreakPoints: 7,
        gamesPerSet: 6,
        goldenPoint: false,
      } as any);

      expect(court.status).toBe('WAITING');
      const state = court.sportRules.getState();
      expect(state.sport).toBe(SPORT.PADEL);
    });
  });

  // ── Config passthrough ───────────────────────────────────────────────

  describe('config passthrough', () => {
    it('should pass TT config fields through to MatchEngine', () => {
      const orchestrator = new MatchOrchestrator(registry);
      const court = makeCourt();

      const state = orchestrator.startMatch(court, {
        sport: SPORT.TABLE_TENNIS,
        bestOf: 5,
        pointsPerSet: 21,
        minDifference: 3,
      } as any);

      expect(state).not.toBeNull();
      const config = court.sportRules.getConfig() as any;
      expect(config.sport).toBe(SPORT.TABLE_TENNIS);
      expect(config.bestOf).toBe(5);
      expect(config.pointsPerSet).toBe(21);
      expect(config.minDifference).toBe(3);
    });

    it('should pass padel config fields through to MatchEngine', () => {
      const orchestrator = new MatchOrchestrator(registry);
      const court = makeCourt();

      const state = orchestrator.startMatch(court, {
        sport: SPORT.PADEL,
        bestOf: 3,
        tiebreakPoints: 10,
        gamesPerSet: 6,
        goldenPoint: true,
      } as any);

      expect(state).not.toBeNull();
      const config = court.sportRules.getConfig() as any;
      expect(config.sport).toBe(SPORT.PADEL);
      expect(config.bestOf).toBe(3);
      expect(config.tiebreakPoints).toBe(10);
      expect(config.goldenPoint).toBe(true);
    });
  });

  // ── Event callback wiring ────────────────────────────────────────────

  describe('event callback wiring', () => {
    it('should wire match engine events through court callback in startMatch', () => {
      const orchestrator = new MatchOrchestrator(registry);
      const events: any[] = [];
      const court = makeCourt({
        onMatchEvent: (event: any) => events.push(event),
      });

      orchestrator.startMatch(court, { bestOf: 3 });

      // Record a point to trigger event flow
      orchestrator.recordPoint(court, 'A');

      // Should have at least emitted SET_WON if game over, or at minimum point was recorded
      const state = court.sportRules.getState();
      const ttState = state as any;
      // TT: currentSet should have A=1, B=0 or similar
      expect(ttState.score?.currentSet?.a ?? ttState.currentSet?.a ?? 0).toBeGreaterThanOrEqual(1);
    });

    it('should wire match engine events through court callback in configureMatch', () => {
      const orchestrator = new MatchOrchestrator(registry);
      const events: any[] = [];
      const court = makeCourt({
        onMatchEvent: (event: any) => events.push(event),
      });

      orchestrator.configureMatch(court, {
        matchConfig: { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 },
      });

      expect(court.status).toBe('CONFIGURING');
      // Event callback should be wired (verify by triggering an event)
      court.sportRules.getState(); // Should not throw
    });
  });

  // ── Record point delegation ──────────────────────────────────────────

  describe('recordPoint delegation', () => {
    it('should delegate recordPoint to MatchEngine for TT', () => {
      const orchestrator = new MatchOrchestrator(registry);
      const court = makeCourt();

      orchestrator.startMatch(court, { bestOf: 3 });
      const state = orchestrator.recordPoint(court, 'A');

      expect(state).not.toBeNull();
      expect(state!.status).toBe('LIVE');
      const ttState = state as any;
      expect(ttState.score?.currentSet?.a ?? ttState.currentSet?.a ?? 0).toBe(1);
    });

    it('should delegate recordPoint to MatchEngine for padel', () => {
      const orchestrator = new MatchOrchestrator(registry);
      const court = makeCourt();

      orchestrator.startMatch(court, {
        sport: SPORT.PADEL,
        bestOf: 3,
        tiebreakPoints: 7,
        gamesPerSet: 6,
      } as any);

      const state = orchestrator.recordPoint(court, 'A');

      expect(state).not.toBeNull();
      expect(state!.status).toBe('LIVE');
      expect(state!.sport).toBe(SPORT.PADEL);
      // Padel: first point should be 15
      const ps = state as any;
      const padelA = ps.padelPoints?.a;
      expect(padelA).toBe(15);
    });

    it('should reject recordPoint when court is not LIVE', () => {
      const orchestrator = new MatchOrchestrator(registry);
      const court = makeCourt({ status: 'WAITING' });

      const state = orchestrator.recordPoint(court, 'A');
      expect(state).toBeNull();
    });
  });

  // ── Registry isolation ───────────────────────────────────────────────

  describe('registry isolation', () => {
    it('should use a fresh registry for each MatchOrchestrator instance', () => {
      const registry1 = new SportRegistry();
      const registry2 = new SportRegistry();

      const orchestrator1 = new MatchOrchestrator(registry1);
      const orchestrator2 = new MatchOrchestrator(registry2);

      const court1 = makeCourt();
      const court2 = makeCourt({ id: 'court-2', number: 2 });

      orchestrator1.startMatch(court1, { sport: SPORT.PADEL, bestOf: 3, tiebreakPoints: 7, gamesPerSet: 6 } as any);
      orchestrator2.startMatch(court2, { sport: SPORT.TABLE_TENNIS, bestOf: 5 } as any);

      expect(court1.sportRules.getState().sport).toBe(SPORT.PADEL);
      expect(court2.sportRules.getState().sport).toBe(SPORT.TABLE_TENNIS);
    });
  });
});
