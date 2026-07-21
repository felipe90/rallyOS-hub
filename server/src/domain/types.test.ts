/**
 * ClubCourt domain type tests — PR 1 Foundation
 *
 * Verifies the new `sessionMode: SessionMode | null` field on ClubCourt
 * (server internal type). The field is required at the type level but
 * accepts null for unoccupied/typed-but-unset courts.
 */

import {
  ClubCourt,
  SessionMode,
} from './types';
import { SESSION_MODE, SPORT } from '../../../shared/types';
import { MatchEngine } from './matchEngine';

describe('ClubCourt.sessionMode', () => {
  test('ClubCourt accepts sessionMode = "free"', () => {
    const court: ClubCourt = {
      kind: 'club',
      id: 'c-1',
      number: 1,
      name: 'Mesa 1',
      clubStatus: 'OCCUPIED',
      pin: '1234',
      sportRules: new MatchEngine(),
      playerNames: { a: 'Alice', b: 'Bob' },
      history: [],
      players: [],
      createdAt: 0,
      featured: false,
      occupiedAt: 1000,
      sessionMode: SESSION_MODE.FREE,
      // player-identity defaults — null until populated by startFreePlay/
      // newMatch/adminOccupyCourt. Cleared back to null by resetCourt.
      playerName: null,
      phone: null,
      adminId: null,
    };

    expect(court.sessionMode).toBe('free');
  });

  test('ClubCourt accepts sessionMode = "match"', () => {
    const court: ClubCourt = makeClubCourt({ sessionMode: SESSION_MODE.MATCH });
    expect(court.sessionMode).toBe('match');
  });

  test('ClubCourt accepts sessionMode = null (unoccupied state)', () => {
    // An AVAILABLE/RESERVED club court has no active session — null is the
    // correct value. This is a real null, not undefined, to make the field
    // required at the type level (forces callers to think about it).
    const court: ClubCourt = makeClubCourt({ sessionMode: null });
    expect(court.sessionMode).toBeNull();
  });

  test('sessionMode is mutable — a court can transition free -> match', () => {
    const court: ClubCourt = makeClubCourt({ sessionMode: SESSION_MODE.FREE });
    expect(court.sessionMode).toBe('free');

    court.sessionMode = SESSION_MODE.MATCH;
    expect(court.sessionMode).toBe('match');
  });
});

// ── Helpers ────────────────────────────────────────────────────────────

function makeClubCourt(overrides: Partial<ClubCourt> = {}): ClubCourt {
  const engine = new MatchEngine();
  engine.setCourtId('c-1', 'Mesa 1');
  return {
    kind: 'club',
    id: 'c-1',
    number: 1,
    name: 'Mesa 1',
    clubStatus: 'OCCUPIED',
    pin: '1234',
    sportRules: engine,
    playerNames: { a: 'Alice', b: 'Bob' },
    history: [],
    players: [],
    createdAt: 0,
    featured: false,
    occupiedAt: 1000,
    sessionMode: null,
    // player-identity defaults — null until populated by startFreePlay /
    // newMatch / adminOccupyCourt. Cleared back to null by resetCourt.
    playerName: null,
    phone: null,
    adminId: null,
    ...overrides,
  };
}