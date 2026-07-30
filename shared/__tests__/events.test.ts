/**
 * Club session lifecycle event tests — PR 1 Foundation
 *
 * Covers the new C→S and S→C socket events introduced by the
 * club session lifecycle feature.
 */

import { SocketEvents } from '../events';

describe('Club session lifecycle — client → server events', () => {
  test('CLUB_START_FREE event name is registered', () => {
    expect(SocketEvents.CLIENT.CLUB_START_FREE).toBeDefined();
    expect(typeof SocketEvents.CLIENT.CLUB_START_FREE).toBe('string');
  });

  test('CLUB_START_FREE equals "CLUB_START_FREE"', () => {
    expect(SocketEvents.CLIENT.CLUB_START_FREE).toBe('CLUB_START_FREE');
  });

  test('CLUB_RESET_MATCH event name is registered', () => {
    expect(SocketEvents.CLIENT.CLUB_RESET_MATCH).toBeDefined();
    expect(SocketEvents.CLIENT.CLUB_RESET_MATCH).toBe('CLUB_RESET_MATCH');
  });

  test('CLUB_NEW_MATCH event name is registered', () => {
    expect(SocketEvents.CLIENT.CLUB_NEW_MATCH).toBeDefined();
    expect(SocketEvents.CLIENT.CLUB_NEW_MATCH).toBe('CLUB_NEW_MATCH');
  });

  test('original club events remain intact', () => {
    // Sanity — we must not have dropped existing events.
    expect(SocketEvents.CLIENT.CLUB_END_SESSION).toBe('CLUB_END_SESSION');
    expect(SocketEvents.CLIENT.CLUB_RECONNECT).toBe('CLUB_RECONNECT');
    expect(SocketEvents.CLIENT.CLUB_FORCE_END).toBe('CLUB_FORCE_END');
  });
});

describe('Club session lifecycle — server → client events', () => {
  test('CLUB_FREE_STARTED event name is registered', () => {
    expect(SocketEvents.SERVER.CLUB_FREE_STARTED).toBeDefined();
    expect(SocketEvents.SERVER.CLUB_FREE_STARTED).toBe('CLUB_FREE_STARTED');
  });

  test('CLUB_MATCH_RESET event name is registered', () => {
    expect(SocketEvents.SERVER.CLUB_MATCH_RESET).toBeDefined();
    expect(SocketEvents.SERVER.CLUB_MATCH_RESET).toBe('CLUB_MATCH_RESET');
  });

  test('CLUB_SESSION_TIMER event name is registered', () => {
    expect(SocketEvents.SERVER.CLUB_SESSION_TIMER).toBeDefined();
    expect(SocketEvents.SERVER.CLUB_SESSION_TIMER).toBe('CLUB_SESSION_TIMER');
  });

  // PR 3 event swap — dedicated confirmation signal so the client no longer
  // has to infer confirmation from a periodic CLUB_SESSION_TIMER frame.
  test('CLUB_END_SESSION_CONFIRM event name is registered', () => {
    expect(SocketEvents.SERVER.CLUB_END_SESSION_CONFIRM).toBeDefined();
    expect(SocketEvents.SERVER.CLUB_END_SESSION_CONFIRM).toBe('CLUB_END_SESSION_CONFIRM');
  });

  test('original club server events remain intact', () => {
    expect(SocketEvents.SERVER.CLUB_SESSION_ENDED).toBe('CLUB_SESSION_ENDED');
    expect(SocketEvents.SERVER.CLUB_RECONNECT_RESULT).toBe('CLUB_RECONNECT_RESULT');
  });
});

describe('Club session lifecycle — event name uniqueness', () => {
  test('every event string value in CLIENT is unique within CLIENT', () => {
    const clientValues = Object.values(SocketEvents.CLIENT);
    const dupes = clientValues.filter((v, i, arr) => arr.indexOf(v) !== i);
    expect(dupes).toEqual([]);
  });

  test('every new club-lifecycle CLIENT event is unique across the whole dictionary', () => {
    const allValues = [
      ...Object.values(SocketEvents.CLIENT),
      ...Object.values(SocketEvents.SERVER),
    ];
    const newEvents = [
      SocketEvents.CLIENT.CLUB_START_FREE,
      SocketEvents.CLIENT.CLUB_RESET_MATCH,
      SocketEvents.CLIENT.CLUB_NEW_MATCH,
      SocketEvents.SERVER.CLUB_FREE_STARTED,
      SocketEvents.SERVER.CLUB_MATCH_RESET,
      SocketEvents.SERVER.CLUB_SESSION_TIMER,
      SocketEvents.SERVER.CLUB_END_SESSION_CONFIRM,
    ];
    for (const ev of newEvents) {
      // The event name can legitimately appear exactly once (itself).
      const occurrences = allValues.filter((v) => v === ev).length;
      expect(occurrences).toBe(1);
    }
  });

  // PR 3 event swap — explicitly assert the new confirm event is distinct
  // from CLUB_SESSION_TIMER so the client can disambiguate a confirmation
  // signal from a periodic timer sync.
  test('CLUB_END_SESSION_CONFIRM is distinct from CLUB_SESSION_TIMER', () => {
    expect(SocketEvents.SERVER.CLUB_END_SESSION_CONFIRM).not.toBe(
      SocketEvents.SERVER.CLUB_SESSION_TIMER,
    );
  });
});

// ── Club session history events (PR 1 Foundation) ──────────────────────

describe('Club session history — client → server events', () => {
  test('CLUB_CLEAR_HISTORY event name is registered', () => {
    expect(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY).toBeDefined();
    expect(typeof SocketEvents.CLIENT.CLUB_CLEAR_HISTORY).toBe('string');
  });

  test('CLUB_CLEAR_HISTORY equals "CLUB_CLEAR_HISTORY"', () => {
    expect(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY).toBe('CLUB_CLEAR_HISTORY');
  });

  test('CLUB_CLEAR_HISTORY_CONFIRM event name is registered', () => {
    expect(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY_CONFIRM).toBeDefined();
    expect(typeof SocketEvents.CLIENT.CLUB_CLEAR_HISTORY_CONFIRM).toBe('string');
  });

  test('CLUB_CLEAR_HISTORY_CONFIRM equals "CLUB_CLEAR_HISTORY_CONFIRM"', () => {
    expect(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY_CONFIRM).toBe('CLUB_CLEAR_HISTORY_CONFIRM');
  });
});

describe('Club session history — server → client events', () => {
  test('CLUB_SESSION_HISTORY event name is registered', () => {
    expect(SocketEvents.SERVER.CLUB_SESSION_HISTORY).toBeDefined();
    expect(typeof SocketEvents.SERVER.CLUB_SESSION_HISTORY).toBe('string');
  });

  test('CLUB_SESSION_HISTORY equals "CLUB_SESSION_HISTORY"', () => {
    expect(SocketEvents.SERVER.CLUB_SESSION_HISTORY).toBe('CLUB_SESSION_HISTORY');
  });

  test('CLUB_SESSION_HISTORY is distinct from CLUB_KIOSK_DATA (history must not leak to kiosk channel)', () => {
    expect(SocketEvents.SERVER.CLUB_SESSION_HISTORY).not.toBe(
      SocketEvents.SERVER.CLUB_KIOSK_DATA,
    );
  });
});

describe('Club session history — event name uniqueness', () => {
  test('every new club-history event is unique across the whole dictionary', () => {
    const allValues = [
      ...Object.values(SocketEvents.CLIENT),
      ...Object.values(SocketEvents.SERVER),
    ];
    const newEvents = [
      SocketEvents.CLIENT.CLUB_CLEAR_HISTORY,
      SocketEvents.CLIENT.CLUB_CLEAR_HISTORY_CONFIRM,
      SocketEvents.SERVER.CLUB_SESSION_HISTORY,
    ];
    for (const ev of newEvents) {
      // The event name can legitimately appear exactly once (itself).
      const occurrences = allValues.filter((v) => v === ev).length;
      expect(occurrences).toBe(1);
    }
  });

  test('CLUB_CLEAR_HISTORY and CLUB_CLEAR_HISTORY_CONFIRM are distinct events', () => {
    expect(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY).not.toBe(
      SocketEvents.CLIENT.CLUB_CLEAR_HISTORY_CONFIRM,
    );
  });
});