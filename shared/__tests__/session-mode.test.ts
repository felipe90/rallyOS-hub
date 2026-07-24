/**
 * Session mode type tests — PR 1 Foundation
 *
 * Covers the new SessionMode union and the `sessionMode` optional field
 * added to ClubKioskCourtInfo, ClubCourtInfo, and CourtInfo for the
 * club session lifecycle feature.
 *
 * The project convention is to expose a const map + a derived union type
 * (see SPORT, CLUB_STATUS, COURT_MODE). We follow the same pattern with
 * SESSION_MODE + SessionMode.
 */

import {
  SESSION_MODE,
  SessionMode,
  ClubKioskCourtInfo,
  ClubCourtInfo,
  CourtInfo,
  CLUB_STATUS,
  COURT_MODE,
} from '../types';

describe('SESSION_MODE const', () => {
  test('exposes FREE and MATCH string constants', () => {
    expect(SESSION_MODE.FREE).toBe('free');
    expect(SESSION_MODE.MATCH).toBe('match');
  });

  test('SessionMode union equals "free" | "match"', () => {
    const modes: SessionMode[] = [SESSION_MODE.FREE, SESSION_MODE.MATCH];
    expect(modes).toEqual(['free', 'match']);
    expect(new Set(modes).size).toBe(2);
  });
});

describe('ClubKioskCourtInfo.sessionMode', () => {
  test('accepts a club kiosk court info with sessionMode = "free"', () => {
    const info: ClubKioskCourtInfo = {
      id: 'court-1',
      name: 'Mesa 1',
      status: CLUB_STATUS.OCCUPIED,
      mode: COURT_MODE.CLUB,
      sessionMode: SESSION_MODE.FREE,
    };
    expect(info.sessionMode).toBe('free');
  });

  test('accepts a club kiosk court info with sessionMode = "match"', () => {
    const info: ClubKioskCourtInfo = {
      id: 'court-2',
      name: 'Mesa 2',
      status: CLUB_STATUS.OCCUPIED,
      mode: COURT_MODE.CLUB,
      sessionMode: SESSION_MODE.MATCH,
    };
    expect(info.sessionMode).toBe('match');
  });

  test('sessionMode optional — undefined is allowed for backward compat', () => {
    const info: ClubKioskCourtInfo = {
      id: 'court-3',
      name: 'Mesa 3',
      status: CLUB_STATUS.AVAILABLE,
      mode: COURT_MODE.CLUB,
    };
    expect(info.sessionMode).toBeUndefined();
  });
});

describe('ClubCourtInfo.sessionMode', () => {
  test('accepts a club court info with sessionMode', () => {
    const info: ClubCourtInfo = {
      id: 'court-a',
      name: 'Mesa A',
      status: CLUB_STATUS.OCCUPIED,
      mode: COURT_MODE.CLUB,
      sessionMode: SESSION_MODE.MATCH,
    };
    expect(info.sessionMode).toBe('match');
  });
});

describe('CourtInfo.sessionMode', () => {
  test('accepts a court info with sessionMode = "free"', () => {
    const info: CourtInfo = {
      id: 'court-x',
      number: 1,
      name: 'Mesa X',
      status: CLUB_STATUS.OCCUPIED,
      playerCount: 2,
      mode: COURT_MODE.CLUB,
      sessionMode: SESSION_MODE.FREE,
    };
    expect(info.sessionMode).toBe('free');
  });

  test('accepts a court info without sessionMode (tournament mode compat)', () => {
    const info: CourtInfo = {
      id: 'court-y',
      number: 2,
      name: 'Mesa Y',
      status: 'LIVE',
      playerCount: 2,
    };
    expect(info.sessionMode).toBeUndefined();
  });
});