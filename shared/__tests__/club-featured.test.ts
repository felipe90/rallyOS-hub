/**
 * Club featured court type tests — task 1 of `club-featured-courts` change.
 *
 * Asserts the new `featured?: boolean` field is assignable on both
 * `ClubKioskCourtInfo` and `ClubCourtInfo`. The field is optional for
 * backward compatibility (existing clients that pre-date this change
 * must keep parsing without the field).
 *
 * NOTE: This is a purely structural type-export task — the RED gate is
 * enforced at the TypeScript compile level (`tsc --noEmit` rejects object
 * literals with `featured: true` until the field is declared on the
 * interface). At runtime vitest strips types, so the test only proves
 * the field round-trips after it exists. Triangulation is intentionally
 * skipped: there is literally one possible output (an optional boolean
 * field) with no branching or logic.
 */

import {
  ClubKioskCourtInfo,
  ClubCourtInfo,
  CLUB_STATUS,
  COURT_MODE,
} from '../types';

describe('ClubKioskCourtInfo.featured', () => {
  test('accepts a club kiosk court info with featured = true', () => {
    const info: ClubKioskCourtInfo = {
      id: 'court-1',
      name: 'Mesa 1',
      status: CLUB_STATUS.AVAILABLE,
      mode: COURT_MODE.CLUB,
      featured: true,
    };
    expect(info.featured).toBe(true);
  });

  test('accepts a club kiosk court info with featured = false', () => {
    const info: ClubKioskCourtInfo = {
      id: 'court-2',
      name: 'Mesa 2',
      status: CLUB_STATUS.RESERVED,
      mode: COURT_MODE.CLUB,
      featured: false,
    };
    expect(info.featured).toBe(false);
  });

  test('featured is optional — undefined is allowed for backward compat', () => {
    const info: ClubKioskCourtInfo = {
      id: 'court-3',
      name: 'Mesa 3',
      status: CLUB_STATUS.AVAILABLE,
      mode: COURT_MODE.CLUB,
    };
    expect(info.featured).toBeUndefined();
  });
});

describe('ClubCourtInfo.featured', () => {
  test('accepts a club court info with featured = true', () => {
    const info: ClubCourtInfo = {
      id: 'court-a',
      name: 'Mesa A',
      status: CLUB_STATUS.AVAILABLE,
      mode: COURT_MODE.CLUB,
      featured: true,
    };
    expect(info.featured).toBe(true);
  });

  test('featured is optional — undefined is allowed for backward compat', () => {
    const info: ClubCourtInfo = {
      id: 'court-b',
      name: 'Mesa B',
      status: CLUB_STATUS.FINISHED,
      mode: COURT_MODE.CLUB,
    };
    expect(info.featured).toBeUndefined();
  });
});