/**
 * ClubFlowContract tests — club session flow (FMR-3, AFE-3).
 *
 * States OCCUPIED → FINISHED; availabilityOf(OCCUPIED) = BUSY;
 * end() settles cost = ceil(elapsedMinutes × costPerMinute); forceEnd()
 * adminId-stamps, finalizes cost, releases → IDLE; canArchive false while
 * BUSY; release() is a no-op (club courts untouched by releaseAll, TCS-3).
 */
import { ClubFlowContract } from './ClubFlowContract';
import { CLUB_STATUS, AVAILABILITY, SESSION_MODE } from '../../../../shared/types';
import type { ClubCourt } from '../types';
import { MatchEngine } from '../matchEngine';

const contract = new ClubFlowContract();

function clubCourt(overrides: Partial<ClubCourt> = {}): ClubCourt {
  return {
    kind: 'club',
    id: 'club-1',
    number: 1,
    name: 'Mesa 1',
    clubStatus: CLUB_STATUS.AVAILABLE,
    pin: '1234',
    sportRules: new MatchEngine(),
    playerNames: { a: '', b: '' },
    history: [],
    players: [],
    createdAt: Date.now(),
    featured: false,
    occupiedAt: null,
    sessionMode: null,
    playerName: null,
    phone: null,
    adminId: null,
    ...overrides,
  };
}

const occupied = (overrides: Partial<ClubCourt> = {}): ClubCourt =>
  clubCourt({ clubStatus: CLUB_STATUS.OCCUPIED, occupiedAt: Date.now(), ...overrides });

describe('ClubFlowContract — contract surface (FMR-2)', () => {
  it('declares key, states and allowedTransitions', () => {
    expect(contract.key).toBe('club');
    expect(contract.states).toEqual(['OCCUPIED', 'FINISHED']);
    expect(contract.allowedTransitions.OCCUPIED).toEqual(['FINISHED']);
  });
});

describe('ClubFlowContract — availabilityOf (FMR-3)', () => {
  it('maps OCCUPIED → BUSY', () => {
    expect(contract.availabilityOf(CLUB_STATUS.OCCUPIED)).toBe(AVAILABILITY.BUSY);
  });

  it('maps AVAILABLE / RESERVED / FINISHED → IDLE', () => {
    expect(contract.availabilityOf(CLUB_STATUS.AVAILABLE)).toBe(AVAILABILITY.IDLE);
    expect(contract.availabilityOf(CLUB_STATUS.RESERVED)).toBe(AVAILABILITY.IDLE);
    expect(contract.availabilityOf(CLUB_STATUS.FINISHED)).toBe(AVAILABILITY.IDLE);
  });
});

describe('ClubFlowContract — occupy (FMR-2)', () => {
  it('transitions RESERVED → OCCUPIED, starts the timer and captures identity', () => {
    const court = clubCourt({ clubStatus: CLUB_STATUS.RESERVED, playerName: null });
    const before = Date.now();
    const ok = contract.occupy!(court, { playerName: 'Ana', phone: 'enc:1', sessionMode: SESSION_MODE.MATCH });
    expect(ok).toBe(true);
    expect(court.clubStatus).toBe(CLUB_STATUS.OCCUPIED);
    expect(court.occupiedAt).not.toBeNull();
    expect(court.occupiedAt!).toBeGreaterThanOrEqual(before);
    expect(court.playerName).toBe('Ana');
    expect(court.phone).toBe('enc:1');
    expect(court.sessionMode).toBe(SESSION_MODE.MATCH);
  });

  it('rejects non-RESERVED courts (AVAILABLE / OCCUPIED / FINISHED)', () => {
    expect(contract.occupy!(clubCourt())).toBe(false);
    expect(contract.occupy!(occupied())).toBe(false);
    expect(contract.occupy!(clubCourt({ clubStatus: CLUB_STATUS.FINISHED }))).toBe(false);
  });
});

describe('ClubFlowContract — start (session mode + identity)', () => {
  it('sets sessionMode free and captures identity when provided', () => {
    const court = occupied();
    const ok = contract.start!(court, { sessionMode: SESSION_MODE.FREE, playerName: 'Ana', phone: 'enc:1' });
    expect(ok).toBe(true);
    expect(court.sessionMode).toBe(SESSION_MODE.FREE);
    expect(court.playerName).toBe('Ana');
    expect(court.phone).toBe('enc:1');
  });

  it('preserves existing identity when omitted (idempotent re-entry)', () => {
    const court = occupied({ sessionMode: SESSION_MODE.MATCH, playerName: 'Ana', phone: 'enc:1' });
    contract.start!(court, { sessionMode: SESSION_MODE.FREE });
    expect(court.sessionMode).toBe(SESSION_MODE.FREE);
    expect(court.playerName).toBe('Ana');
    expect(court.phone).toBe('enc:1');
  });

  it('rejects a non-OCCUPIED court', () => {
    expect(contract.start!(clubCourt({ clubStatus: CLUB_STATUS.RESERVED }), { sessionMode: SESSION_MODE.FREE })).toBe(false);
  });
});

describe('ClubFlowContract — end → settled cost (FMR-3)', () => {
  it('transitions OCCUPIED → FINISHED, clears pin, returns elapsed (min 1) + settled cost', () => {
    const court = occupied({ occupiedAt: Date.now() - 65_000 }); // 65s → ceil = 2 min
    const result = contract.end(court, { costPerMinute: 50, currency: 'ARS' });
    expect(result).not.toBeNull();
    expect(result!.elapsedMinutes).toBe(2);
    expect(result!.elapsedSeconds).toBe(65);
    expect(result!.cost).toBe(100); // 2 × 50
    expect(result!.currency).toBe('ARS');
    expect(court.clubStatus).toBe(CLUB_STATUS.FINISHED);
    expect(court.pin).toBe('');
  });

  it('enforces a minimum of 1 elapsed minute for a just-started session', () => {
    const court = occupied(); // occupiedAt = now
    const result = contract.end(court, { costPerMinute: 30 });
    expect(result!.elapsedMinutes).toBe(1);
    expect(result!.cost).toBe(30);
  });

  it('settles cost 0 for free sessions (costPerMinute 0)', () => {
    const court = occupied({ occupiedAt: Date.now() - 120_000 });
    const result = contract.end(court, { costPerMinute: 0 });
    expect(result!.elapsedMinutes).toBe(2);
    expect(result!.cost).toBe(0);
  });

  it('returns null for a non-OCCUPIED court', () => {
    expect(contract.end(clubCourt({ clubStatus: CLUB_STATUS.RESERVED }))).toBeNull();
    expect(contract.end(clubCourt({ clubStatus: CLUB_STATUS.FINISHED }))).toBeNull();
  });
});

describe('ClubFlowContract — forceEnd (AFE-3)', () => {
  it('finalizes cost, releases → FINISHED, and returns the settled fields', () => {
    const court = occupied({ occupiedAt: Date.now() - 65_000, adminId: null });
    const result = contract.forceEnd(court, 'admin-1', { costPerMinute: 50, currency: 'ARS' });
    expect(result).not.toBeNull();
    expect(result!.releasedCourtId).toBe('club-1');
    expect(result!.elapsedMinutes).toBe(2);
    expect(result!.cost).toBe(100);
    expect(result!.currency).toBe('ARS');
    // AFE-3: released → availability IDLE (no longer BUSY).
    expect(contract.availabilityOf(court.clubStatus)).toBe(AVAILABILITY.IDLE);
  });

  it('stamps the force-ending adminId BEFORE release (traceability)', () => {
    const court = occupied({ adminId: null });
    contract.forceEnd(court, 'admin-1');
    expect(court.adminId).toBe('admin-1');
  });

  it('does NOT stamp when adminId is empty (backward compatible)', () => {
    const court = occupied({ adminId: 'starter-admin' });
    contract.forceEnd(court, '');
    expect(court.adminId).toBe('starter-admin');
  });

  it('returns null for a non-OCCUPIED court', () => {
    expect(contract.forceEnd(clubCourt({ clubStatus: CLUB_STATUS.RESERVED }), 'admin-1')).toBeNull();
  });
});

describe('ClubFlowContract — canArchive (INV-5)', () => {
  it('is false while BUSY (OCCUPIED)', () => {
    expect(contract.canArchive(occupied())).toBe(false);
  });

  it('is true when the court is not BUSY (AVAILABLE / RESERVED / FINISHED)', () => {
    expect(contract.canArchive(clubCourt())).toBe(true);
    expect(contract.canArchive(clubCourt({ clubStatus: CLUB_STATUS.RESERVED }))).toBe(true);
    expect(contract.canArchive(clubCourt({ clubStatus: CLUB_STATUS.FINISHED }))).toBe(true);
  });
});

describe('ClubFlowContract — release (TCS-3)', () => {
  it('is a no-op — club courts are untouched by tournament releaseAll', () => {
    const court = occupied();
    contract.release(court);
    expect(court.clubStatus).toBe(CLUB_STATUS.OCCUPIED);
    expect(court.occupiedAt).not.toBeNull();
  });
});

describe('ClubFlowContract — serialize', () => {
  it('produces the flow-session row for OCCUPIED flows', () => {
    const court = occupied({ sessionMode: SESSION_MODE.MATCH, playerName: 'Ana', phone: 'enc:1', adminId: 'admin-1' });
    const row = contract.serialize(court);
    expect(row).not.toBeNull();
    expect(row!.courtId).toBe('club-1');
    expect(row!.flow).toEqual({
      mode: 'club',
      state: 'OCCUPIED',
      sessionMode: SESSION_MODE.MATCH,
      occupiedAt: court.occupiedAt,
      playerName: 'Ana',
      phone: 'enc:1',
      adminId: 'admin-1',
    });
  });

  it('returns null for courts with no active/persisted flow', () => {
    expect(contract.serialize(clubCourt())).toBeNull();
    expect(contract.serialize(clubCourt({ clubStatus: CLUB_STATUS.RESERVED }))).toBeNull();
  });
});
