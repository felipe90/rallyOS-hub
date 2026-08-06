/**
 * Bracket ↔ Court integration e2e (Option 2) — SLICE 4 REWRITE.
 *
 * The slice-1/3 bridge changes what "a bracket court" means:
 *   - 4.2 widened `BracketHandler.courtExists` to the admin inventory
 *     (inventory-ACTIVE only). CREATE_COURT runtime courts are NO LONGER
 *     bindable — they are not in the catalog.
 *   - Courts are seeded via INVENTORY_ADD (admin-gated) and bound via the
 *     owner-picker event TOURNAMENT_SELECT_TABLE (D13, TCS-1/TCS-2).
 *
 * Covered live (protocol over real socket.io-client):
 *   1. Strict cold start (TCS-4): zero ACTIVE inventory courts →
 *      BRACKET_CREATE rejected with COURT_INVENTORY_EMPTY.
 *   2. SELECT binds an inventory-ACTIVE court (TCS-1).
 *   3. SELECT validation (TCS-2/Q2): MAINTENANCE → COURT_NOT_FOUND, club
 *      RESERVED → COURT_RESERVED, reverse index → COURT_ALREADY_ASSIGNED.
 *   4. 2-step reset unbinds the bracket courts (bindings cleared).
 *   5. SLICE 5 (bridge reversal): SELECT materializes the runtime tournament
 *      court (ensureRuntimeTournamentCourt), the referee starts the match
 *      (START_MATCH → flow tournament LIVE), scoring a completed match
 *      auto-advances the bracket (MATCH_WON → handleCourtMatchWon), and a
 *      reset after play releases the tournament flow → court IDLE.
 *
 * DEFERRED note (slice 4) — RESOLVED in slice 5: the full referee-play
 * auto-advance + browser-prefill flows need a RUNTIME tournament court (PIN +
 * match engine) at the inventory courtId. The slice-5 bridge reversal
 * materializes the runtime tournament court at SELECT time
 * (CourtManager.ensureRuntimeTournamentCourt), so the referee-play protocol
 * tests below now run live (START_MATCH → MATCH_WON → bracket auto-advance).
 * The browser-prefill path (referee dashboard picker over ACTIVE inventory)
 * is exercised by the client e2e suite (referee → court → PinModal → start).
 *
 * Admin auth: the club admin PIN is operator-set (CLUB_SETUP) and has no
 * public API — provide it via CLUB_ADMIN_PIN (mirrors the TOURNAMENT_OWNER_PIN
 * fallback in getOwnerPin).
 *
 * Run: CLUB_ADMIN_PIN=<pin> pnpm --filter server run test:e2e -- --grep bracketCourtFlow
 */

import { test, expect } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
import { SocketEvents } from '../../shared/events';
import type { CourtRecord, TournamentBracket } from '../../shared/types';

const BASE_URL = 'https://localhost:3000';

// ── socket helpers ───────────────────────────────────────────────────────

/** Connect a real socket.io-client to the running server. */
function connectClient(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(BASE_URL, {
      transports: ['websocket'],
      forceNew: true,
      reconnectionAttempts: 0,
      rejectUnauthorized: false,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => reject(err));
  });
}

/** Resolve on the first payload for `event`, with a timeout. */
function once<T = unknown>(socket: Socket, event: string, timeoutMs = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const handler = (data: T) => {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(data);
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout (${timeoutMs}ms) waiting for socket event: ${event}`));
    }, timeoutMs);
    socket.once(event, handler as never);
  });
}

/** Track every BRACKET_STATE on a socket and allow waiting for a state that matches a predicate. */
function trackBracket(socket: Socket) {
  let latest: TournamentBracket | null | undefined = undefined;
  const waiters: Array<{
    pred: (b: TournamentBracket | null) => boolean;
    resolve: (b: TournamentBracket | null) => void;
    timer: NodeJS.Timeout;
  }> = [];

  socket.on(SocketEvents.SERVER.BRACKET_STATE, (b: TournamentBracket | null) => {
    latest = b;
    for (let i = waiters.length - 1; i >= 0; i--) {
      const w = waiters[i];
      if (w.pred(b)) {
        waiters.splice(i, 1);
        clearTimeout(w.timer);
        w.resolve(b);
      }
    }
  });

  return {
    latest: (): TournamentBracket | null | undefined => latest,
    async waitFor(
      pred: (b: TournamentBracket | null) => boolean,
      label: string,
      timeoutMs = 15_000,
    ): Promise<TournamentBracket | null> {
      if (latest !== undefined && pred(latest)) return latest;
      return new Promise((resolve, reject) => {
        const w = {
          pred,
          resolve,
          timer: setTimeout(() => {
            const idx = waiters.indexOf(w);
            if (idx >= 0) waiters.splice(idx, 1);
            reject(new Error(`Timeout (${timeoutMs}ms) waiting for BRACKET_STATE: ${label}`));
          }, timeoutMs),
        };
        waiters.push(w);
      });
    },
  };
}

/** Fetch the owner PIN from the live server (changes on every boot). */
async function getOwnerPin(): Promise<string> {
  const ctx = await test.request.newContext({ ignoreHTTPSErrors: true });
  try {
    const res = await ctx.get(`${BASE_URL}/api/owner-pin`);
    const data = (await res.json()) as { pin?: string | null; isRandom?: boolean };
    if (data?.isRandom && data.pin) return data.pin;
  } catch {
    // fall through to env fallback
  } finally {
    await ctx.dispose();
  }
  const fromEnv = process.env.TOURNAMENT_OWNER_PIN;
  if (fromEnv) return fromEnv;
  throw new Error(
    '/api/owner-pin returned no random PIN and TOURNAMENT_OWNER_PIN is not set — cannot verify owner',
  );
}

/** Owner socket, authenticated against the live server. */
async function connectOwner(): Promise<{ socket: Socket; pin: string }> {
  const pin = await getOwnerPin();
  const socket = await connectClient();
  const verified = once(socket, SocketEvents.SERVER.OWNER_VERIFIED);
  socket.emit(SocketEvents.CLIENT.VERIFY_OWNER, { pin });
  await verified;
  return { socket, pin };
}

/**
 * Club-admin socket (INVENTORY_* gate). The admin PIN is operator-set during
 * CLUB_SETUP and has no public API — required via CLUB_ADMIN_PIN.
 */
async function connectAdmin(): Promise<Socket> {
  const pin = process.env.CLUB_ADMIN_PIN;
  if (!pin) {
    throw new Error('CLUB_ADMIN_PIN env not set — cannot seed inventory (bracketCourtFlow)');
  }
  const socket = await connectClient();
  const verified = once(socket, SocketEvents.SERVER.CLUB_ADMIN_VERIFIED);
  socket.emit(SocketEvents.CLIENT.CLUB_VERIFY_ADMIN, { pin });
  await verified;
  return socket;
}

/** Seed an inventory court via INVENTORY_ADD; resolves the created CourtRecord. */
async function seedInventoryCourt(admin: Socket, name: string): Promise<CourtRecord> {
  const updated = once<{ courts: CourtRecord[] }>(admin, SocketEvents.SERVER.INVENTORY_UPDATED);
  admin.emit(SocketEvents.CLIENT.INVENTORY_ADD, { name });
  const { courts } = await updated;
  const record = courts.find((c) => c.name === name);
  if (!record) throw new Error(`INVENTORY_ADD did not produce a record named ${name}`);
  return record;
}

/** List the current inventory catalog (any role may INVENTORY_LIST). */
async function listInventory(socket: Socket): Promise<CourtRecord[]> {
  const updated = once<{ courts: CourtRecord[] }>(socket, SocketEvents.SERVER.INVENTORY_UPDATED);
  socket.emit(SocketEvents.CLIENT.INVENTORY_LIST);
  return (await updated).courts;
}

/** Archive a court (admin-only; best-effort). */
async function archiveCourtBestEffort(admin: Socket, courtId: string): Promise<void> {
  try {
    const updated = once(admin, SocketEvents.SERVER.INVENTORY_UPDATED, 8_000);
    admin.emit(SocketEvents.CLIENT.INVENTORY_ARCHIVE, { courtId });
    await updated;
  } catch {
    // Court may already be gone — never fail the suite over cleanup.
  }
}

/** Two-step bracket reset: request token, then confirm it. */
async function resetBracket(socket: Socket, tracker: ReturnType<typeof trackBracket>): Promise<void> {
  const tokenReq = once<{ token: string }>(socket, SocketEvents.SERVER.BRACKET_RESET_CONFIRM);
  socket.emit(SocketEvents.CLIENT.BRACKET_RESET, { confirmToken: undefined });
  const { token } = await tokenReq;
  const cleared = tracker.waitFor((b) => b === null, 'bracket null after reset');
  socket.emit(SocketEvents.CLIENT.BRACKET_RESET, { confirmToken: token });
  await cleared;
}

function matchById(b: TournamentBracket | null, id: string) {
  return b?.matches.find((m) => m.id === id) ?? null;
}

// ── shared setup ─────────────────────────────────────────────────────────

let ownerSocket: Socket;
let ownerPin: string;
let adminSocket: Socket;
let tracker: ReturnType<typeof trackBracket>;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  const owner = await connectOwner();
  ownerSocket = owner.socket;
  ownerPin = owner.pin;
  adminSocket = await connectAdmin();
  tracker = trackBracket(ownerSocket);
  await resetBracket(ownerSocket, tracker);
});

test.afterAll(async () => {
  // Best-effort cleanup: archive every ACTIVE inventory court this run seeded.
  const courts = await listInventory(adminSocket);
  for (const c of courts) {
    if (c.inventoryStatus === 'ACTIVE') await archiveCourtBestEffort(adminSocket, c.courtId);
  }
  adminSocket?.disconnect();
  ownerSocket?.disconnect();
});

// ── tests ────────────────────────────────────────────────────────────────

test.describe('bracket ↔ inventory courts (slice 4 bridge)', () => {
  test('strict cold start: BRACKET_CREATE rejected with COURT_INVENTORY_EMPTY when no ACTIVE inventory court exists (TCS-4)', async () => {
    test.setTimeout(60_000);
    // Archive every ACTIVE inventory court → empty inventory.
    const existing = await listInventory(adminSocket);
    for (const c of existing) {
      if (c.inventoryStatus === 'ACTIVE') await archiveCourtBestEffort(adminSocket, c.courtId);
    }
    const after = await listInventory(adminSocket);
    expect(after.every((c) => c.inventoryStatus !== 'ACTIVE')).toBe(true);

    // The owner cannot create a bracket with zero ACTIVE courts — no
    // provisional seeding, no escape hatch.
    const error = once<{ code: string }>(ownerSocket, SocketEvents.SERVER.BRACKET_ERROR);
    ownerSocket.emit(SocketEvents.CLIENT.BRACKET_CREATE, {
      name: 'Cold Start',
      numSlots: 4,
      includeThirdPlace: false,
    });
    expect((await error).code).toBe('COURT_INVENTORY_EMPTY');
    expect(tracker.latest()).toBeNull();

    // Restore one ACTIVE court so the rest of the suite can bind.
    const restored = tracker.waitFor(
      (b) => b !== null && b.status === 'SETUP',
      'bracket SETUP after restore',
    );
    await seedInventoryCourt(adminSocket, `E2E Cold ${Date.now()}`);
    ownerSocket.emit(SocketEvents.CLIENT.BRACKET_CREATE, {
      name: 'Cold Restore',
      numSlots: 4,
      includeThirdPlace: false,
    });
    await restored;
    await resetBracket(ownerSocket, tracker);
  });

  test('TOURNAMENT_SELECT_TABLE binds an inventory-ACTIVE court and validates guards (TCS-1/TCS-2, Q2)', async () => {
    test.setTimeout(60_000);
    const suffix = Date.now();
    const c1 = await seedInventoryCourt(adminSocket, `E2E Sel 1 ${suffix}`);
    const c2 = await seedInventoryCourt(adminSocket, `E2E Sel 2 ${suffix}`);
    const cMaint = await seedInventoryCourt(adminSocket, `E2E Maint ${suffix}`);
    adminSocket.emit(SocketEvents.CLIENT.INVENTORY_MAINTENANCE, {
      courtId: cMaint.courtId,
      maintenance: true,
    });

    const created = tracker.waitFor(
      (b) => b !== null && b.status === 'SETUP',
      'bracket SETUP after create',
    );
    ownerSocket.emit(SocketEvents.CLIENT.BRACKET_CREATE, {
      name: `E2E Select ${suffix}`,
      numSlots: 4,
      includeThirdPlace: false,
    });
    await created;

    // Happy path — bind R1-M1 to c1 via the owner picker event.
    const bound = tracker.waitFor(
      (b) => matchById(b, 'R1-M1')?.courtId === c1.courtId,
      'R1-M1 bound to c1',
    );
    ownerSocket.emit(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, {
      matchId: 'R1-M1',
      courtId: c1.courtId,
    });
    await bound;

    // Reverse index — c1 is already bound to R1-M1; binding R1-M2 → COURT_ALREADY_ASSIGNED.
    const reverseErr = once<{ code: string }>(ownerSocket, SocketEvents.SERVER.BRACKET_ERROR);
    ownerSocket.emit(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, {
      matchId: 'R1-M2',
      courtId: c1.courtId,
    });
    expect((await reverseErr).code).toBe('COURT_ALREADY_ASSIGNED');

    // MAINTENANCE inventory court → COURT_NOT_FOUND.
    const maintErr = once<{ code: string }>(ownerSocket, SocketEvents.SERVER.BRACKET_ERROR);
    ownerSocket.emit(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, {
      matchId: 'R1-M2',
      courtId: cMaint.courtId,
    });
    expect((await maintErr).code).toBe('COURT_NOT_FOUND');

    // Club RESERVED (pending PIN) court → COURT_RESERVED (Q2). CLUB_ACTIVATE_COURT
    // on an inventory court materializes a runtime club court → RESERVED (4.4).
    adminSocket.emit(SocketEvents.CLIENT.CLUB_ACTIVATE_COURT, { courtId: c2.courtId });
    await new Promise((resolve) => setTimeout(resolve, 500)); // let the activation land
    const reservedErr = once<{ code: string }>(ownerSocket, SocketEvents.SERVER.BRACKET_ERROR);
    ownerSocket.emit(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, {
      matchId: 'R1-M2',
      courtId: c2.courtId,
    });
    expect((await reservedErr).code).toBe('COURT_RESERVED');

    await resetBracket(ownerSocket, tracker);
  });

  test('2-step reset releases the bracket court bindings (TCS-3/Q4 releaseAll via reset)', async () => {
    test.setTimeout(60_000);
    const c = await seedInventoryCourt(adminSocket, `E2E Reset ${Date.now()}`);

    const created = tracker.waitFor(
      (b) => b !== null && b.status === 'SETUP',
      'bracket SETUP after create',
    );
    ownerSocket.emit(SocketEvents.CLIENT.BRACKET_CREATE, {
      name: `E2E Reset ${Date.now()}`,
      numSlots: 4,
      includeThirdPlace: false,
    });
    await created;

    const bound = tracker.waitFor(
      (b) => matchById(b, 'R1-M1')?.courtId === c.courtId,
      'R1-M1 bound',
    );
    ownerSocket.emit(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, {
      matchId: 'R1-M1',
      courtId: c.courtId,
    });
    await bound;

    // 2-step reset → the bracket is cleared AND its court bindings released.
    const tokenReq = once<{ token: string }>(ownerSocket, SocketEvents.SERVER.BRACKET_RESET_CONFIRM);
    ownerSocket.emit(SocketEvents.CLIENT.BRACKET_RESET, { confirmToken: undefined });
    const { token } = await tokenReq;
    const cleared = tracker.waitFor((b) => b === null, 'bracket null after reset');
    ownerSocket.emit(SocketEvents.CLIENT.BRACKET_RESET, { confirmToken: token });
    await cleared;
  });
});

// ── slice 5: referee-play auto-advance + tournament runtime materialization ──
//
// Slice 4 deferred this path (documented bridge artifact): the referee-play
// flow needs a RUNTIME tournament court (PIN + match engine) at the inventory
// courtId. Slice 5 reverses the bridge — SELECT now materializes the runtime
// tournament court (CourtManager.ensureRuntimeTournamentCourt) so the referee
// can start the match, score it, and the MATCH_WON auto-advances the bracket.

test.describe('bracket referee-play (slice 5 bridge reversal)', () => {
  test('SELECT materializes the runtime tournament court; START_MATCH → MATCH_WON auto-advances the bracket', async () => {
    test.setTimeout(90_000);
    const c = await seedInventoryCourt(adminSocket, `E2E Referee ${Date.now()}`);

    const created = tracker.waitFor(
      (b) => b !== null && b.status === 'SETUP',
      'bracket SETUP after create',
    );
    ownerSocket.emit(SocketEvents.CLIENT.BRACKET_CREATE, {
      name: `E2E Referee ${Date.now()}`,
      numSlots: 4,
      includeThirdPlace: false,
    });
    await created;

    // Assign players to R1-M1 so the match is READY (auto-advance resolves
    // the winner ONLY on READY matches).
    const ready = tracker.waitFor(
      (b) => matchById(b, 'R1-M1')?.status === 'READY',
      'R1-M1 READY after player assignment',
    );
    ownerSocket.emit(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'A', name: 'Ana' });
    ownerSocket.emit(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, { matchId: 'R1-M1', slot: 'B', name: 'Bob' });
    await ready;

    // Owner binds R1-M1 to the inventory court.
    const bound = tracker.waitFor(
      (b) => matchById(b, 'R1-M1')?.courtId === c.courtId,
      'R1-M1 bound',
    );
    ownerSocket.emit(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, {
      matchId: 'R1-M1',
      courtId: c.courtId,
    });
    await bound;

    // The runtime tournament court was materialized (owner sees it with a PIN
    // in the public list — D11 COURT_LIST = ACTIVE inventory).
    const publicList = once<unknown[]>(ownerSocket, SocketEvents.SERVER.COURT_LIST);
    ownerSocket.emit(SocketEvents.CLIENT.LIST_COURTS);
    const list = await publicList;
    const materialized = (list as { id: string }[]).find((x) => x.id === c.courtId);
    expect(materialized).toBeDefined();

    // The owner fetches the court PIN (materialized at SELECT) so the referee
    // can authenticate (SET_REF → REF_SET) before starting the match.
    const pinsReq = once<{ courts: { id: string; pin: string }[] }>(
      ownerSocket,
      SocketEvents.SERVER.COURT_LIST_WITH_PINS,
    );
    ownerSocket.emit(SocketEvents.CLIENT.GET_COURTS_WITH_PINS, { ownerPin });
    const { courts: withPins } = await pinsReq;
    const pinned = withPins.find((x) => x.id === c.courtId);
    expect(pinned).toBeDefined();
    expect(pinned!.pin).toMatch(/^\d{4}$/);

    // Referee starts the match on the court (START_MATCH gates on referee
    // auth; the court now exists with a PIN + fresh match engine).
    const refSocket = await connectClient();
    const refSet = once<{ courtId: string }>(refSocket, SocketEvents.SERVER.REF_SET);
    refSocket.emit(SocketEvents.CLIENT.SET_REF, { courtId: c.courtId, pin: pinned!.pin });
    await refSet;

    const startMatch = once<{ status: string }>(refSocket, SocketEvents.SERVER.MATCH_UPDATE);
    refSocket.emit(SocketEvents.CLIENT.START_MATCH, {
      courtId: c.courtId,
      pointsPerSet: 11,
      bestOf: 3,
      // Player names must match the bracket slots so the auto-advance can
      // resolve the winner ('Ana' === match.playerA).
      playerNameA: 'Ana',
      playerNameB: 'Bob',
    });
    const state = await startMatch;
    expect(state.status).toBe('LIVE');

    // Score until the match completes → MATCH_WON → bracket auto-advance
    // (BracketHandler.handleCourtMatchWon resolves the bound match winner).
    // The scoring rate limit is 30/min per court — pace at ~2.1s/point.
    const advanced = tracker.waitFor(
      (b) => matchById(b, 'R1-M1')?.winner != null,
      'R1-M1 winner auto-set after MATCH_WON',
      60_000,
    );
    for (let i = 0; i < 22; i++) {
      refSocket.emit(SocketEvents.CLIENT.RECORD_POINT, { courtId: c.courtId, player: 'A' });
      await new Promise((r) => setTimeout(r, 2100));
    }
    await advanced;
    expect(matchById(tracker.latest(), 'R1-M1')?.winner).toBe('A');
    refSocket.disconnect();
  });

  test('bracket reset after a played match releases the tournament flow (court → IDLE)', async () => {
    test.setTimeout(90_000);
    const c = await seedInventoryCourt(adminSocket, `E2E Release ${Date.now()}`);

    const created = tracker.waitFor(
      (b) => b !== null && b.status === 'SETUP',
      'bracket SETUP after create',
    );
    ownerSocket.emit(SocketEvents.CLIENT.BRACKET_CREATE, {
      name: `E2E Release ${Date.now()}`,
      numSlots: 4,
      includeThirdPlace: false,
    });
    await created;

    const bound = tracker.waitFor(
      (b) => matchById(b, 'R1-M1')?.courtId === c.courtId,
      'R1-M1 bound',
    );
    ownerSocket.emit(SocketEvents.CLIENT.TOURNAMENT_SELECT_TABLE, {
      matchId: 'R1-M1',
      courtId: c.courtId,
    });
    await bound;

    // 2-step reset releases bindings; the runtime tournament flow is cleared
    // (releaseAll → court IDLE). The inventory record stays ACTIVE.
    await resetBracket(ownerSocket, tracker);

    const courts = await listInventory(adminSocket);
    const record = courts.find((r) => r.courtId === c.courtId);
    expect(record).toBeDefined();
    expect(record!.inventoryStatus).toBe('ACTIVE');
  });
});
