/**
 * TournamentFlowContract tests — tournament court flow (FMR-4, AFE-2).
 *
 * State LIVE (match running on the court). forceEnd() clears the flow AND
 * unbinds the bracket match (`match.courtId = null`) with NO setWinner and NO
 * advance (AFE-2); release() serves releaseAll on tournament end/reset
 * (FMR-4, TCS-3); LIVE → BUSY, else IDLE.
 */
import { TournamentFlowContract } from './TournamentFlowContract';
import { AVAILABILITY } from '../../../../shared/types';
import type { TournamentCourt } from '../types';
import type { BracketMatch } from '../../../../shared/types';
import { MatchEngine } from '../matchEngine';

const contract = new TournamentFlowContract();

function tournamentCourt(overrides: Partial<TournamentCourt> = {}): TournamentCourt {
  return {
    kind: 'tournament',
    id: 't-1',
    number: 1,
    name: 'Cancha 1',
    status: 'WAITING',
    pin: '1234',
    sportRules: new MatchEngine(),
    playerNames: { a: '', b: '' },
    history: [],
    players: [],
    createdAt: Date.now(),
    featured: false,
    ...overrides,
  };
}

const live = (overrides: Partial<TournamentCourt> = {}): TournamentCourt =>
  tournamentCourt({ status: 'LIVE', ...overrides });

/** A bracket-like binding: resolveMatchForCourt returns it; unbindMatch nulls its courtId. */
function boundMatch(): BracketMatch & { __advanced?: boolean } {
  return {
    id: 'R1-M1',
    round: 1,
    position: 0,
    playerA: 'Ana',
    playerB: 'Bob',
    winner: null,
    status: 'READY',
    courtId: 't-1',
  };
}

function ctxFor(match: BracketMatch) {
  return {
    resolveMatchForCourt: (courtId: string) => (match.courtId === courtId ? match : null),
    unbindMatch: (matchId: string) => {
      if (matchId === match.id) match.courtId = null;
    },
  };
}

describe('TournamentFlowContract — contract surface (FMR-2)', () => {
  it('declares key, states and allowedTransitions', () => {
    expect(contract.key).toBe('tournament');
    expect(contract.states).toEqual(['LIVE']);
    expect(contract.allowedTransitions.LIVE).toEqual([]);
  });
});

describe('TournamentFlowContract — availabilityOf (FMR-4)', () => {
  it('maps LIVE → BUSY', () => {
    expect(contract.availabilityOf('LIVE')).toBe(AVAILABILITY.BUSY);
  });

  it('maps WAITING / CONFIGURING / FINISHED → IDLE', () => {
    expect(contract.availabilityOf('WAITING')).toBe(AVAILABILITY.IDLE);
    expect(contract.availabilityOf('CONFIGURING')).toBe(AVAILABILITY.IDLE);
    expect(contract.availabilityOf('FINISHED')).toBe(AVAILABILITY.IDLE);
  });
});

describe('TournamentFlowContract — forceEnd (AFE-2)', () => {
  it('unbinds the bound bracket match (match.courtId → null) and releases the court to IDLE', () => {
    const court = live();
    const match = boundMatch();
    const result = contract.forceEnd(court, 'admin-1', ctxFor(match));

    expect(result).not.toBeNull();
    expect(result!.releasedCourtId).toBe('t-1');
    expect(result!.unboundMatchId).toBe('R1-M1');
    // Binding cleared → the court is freed.
    expect(match.courtId).toBeNull();
    // Flow cleared → availability IDLE.
    expect(court.status).toBe('WAITING');
    expect(contract.availabilityOf(court.status)).toBe(AVAILABILITY.IDLE);
  });

  it('does NOT setWinner and does NOT advance the bracket match (match data untouched)', () => {
    const court = live();
    const match = boundMatch();
    // Snapshot the match result data — AFE-2: force-end must leave it intact.
    const before = {
      winner: match.winner,
      status: match.status,
      playerA: match.playerA,
      playerB: match.playerB,
      round: match.round,
      position: match.position,
    };

    contract.forceEnd(court, 'admin-1', ctxFor(match));

    expect(match.winner).toBe(before.winner);
    expect(match.status).toBe(before.status);
    expect(match.playerA).toBe(before.playerA);
    expect(match.playerB).toBe(before.playerB);
    expect(match.round).toBe(before.round);
    expect(match.position).toBe(before.position);
    expect(match.courtId).toBeNull(); // only the binding changed
  });

  it('unbinds nothing when the court is not bound, and still releases the flow', () => {
    const court = live();
    const unbind = jest.fn();
    const result = contract.forceEnd(court, 'admin-1', {
      resolveMatchForCourt: () => null,
      unbindMatch: unbind,
    });

    expect(result!.releasedCourtId).toBe('t-1');
    expect(result!.unboundMatchId).toBeUndefined();
    expect(unbind).not.toHaveBeenCalled();
    expect(court.status).toBe('WAITING');
  });

  it('returns null for a non-LIVE court (nothing to stop)', () => {
    const unbind = jest.fn();
    expect(contract.forceEnd(tournamentCourt({ status: 'WAITING' }), 'admin-1', { unbindMatch: unbind })).toBeNull();
    expect(contract.forceEnd(tournamentCourt({ status: 'FINISHED' }), 'admin-1', { unbindMatch: unbind })).toBeNull();
    expect(unbind).not.toHaveBeenCalled();
  });
});

describe('TournamentFlowContract — end (no cost settle)', () => {
  it('returns null — tournament has no per-session cost', () => {
    expect(contract.end(live())).toBeNull();
  });
});

describe('TournamentFlowContract — canArchive (INV-5)', () => {
  it('is false while BUSY (LIVE)', () => {
    expect(contract.canArchive(live())).toBe(false);
  });

  it('is true when not BUSY (WAITING / CONFIGURING / FINISHED)', () => {
    expect(contract.canArchive(tournamentCourt({ status: 'WAITING' }))).toBe(true);
    expect(contract.canArchive(tournamentCourt({ status: 'CONFIGURING' }))).toBe(true);
    expect(contract.canArchive(tournamentCourt({ status: 'FINISHED' }))).toBe(true);
  });
});

describe('TournamentFlowContract — release (FMR-4, TCS-3 releaseAll)', () => {
  it('clears the flow → IDLE (court freed after bindings are cleared by releaseAll)', () => {
    const court = live();
    court.sportRules.startMatch();
    contract.release(court);
    expect(court.status).toBe('WAITING');
    expect(contract.availabilityOf(court.status)).toBe(AVAILABILITY.IDLE);
  });
});

describe('TournamentFlowContract — serialize', () => {
  it('produces the flow-session row for LIVE flows', () => {
    const court = live({ id: 't-1' });
    const row = contract.serialize(court);
    expect(row).not.toBeNull();
    expect(row!.courtId).toBe('t-1');
    expect(row!.flow).toEqual({ mode: 'tournament', state: 'LIVE', startedAt: expect.any(Number) });
  });

  it('returns null when no flow is live', () => {
    expect(contract.serialize(tournamentCourt({ status: 'WAITING' }))).toBeNull();
  });
});
