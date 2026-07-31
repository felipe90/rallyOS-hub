/**
 * Bracket ↔ Court integration e2e (Option 2).
 *
 * Encodes a critical integration flow that was manually verified against the
 * live app and must now be repeatable:
 *   1. Courts bound to bracket matches (BRACKET_ASSIGN_COURT).
 *   2. Referee finishes a court match (MATCH_WON) → the bracket auto-advances
 *      the winner to the next round and auto-feeds the semifinal loser into
 *      the third-place match.
 *   3. Full tournament lifecycle: both semifinals, the final, and the
 *      third-place match are played through courts → the bracket reaches
 *      COMPLETED with the correct podium (champion / runner-up / third).
 *   4. The referee MatchConfigModal prefills player names from the bracket
 *      when the court is bound — verified through a REAL browser against the
 *      REAL server build (catches the stale `client/dist` bundle regression).
 *
 * Protocol strategy: heavy setup runs over real socket.io-client connections
 * (deterministic, fast); only the prefill verification uses a browser page.
 * The server is assumed already running at https://localhost:3000 (same
 * contract as multi-court.spec.ts). No server-side mocks.
 *
 * Determinism notes:
 * - Courts are created ONCE in beforeAll and both tests reuse them. The
 *   server rate-limits CREATE_COURT to 5/min/IP, so creating 4 per run
 *   (2 semis + final + third place) stays under the budget. `createCourt`
 *   still retries on RATE_LIMITED as a safety net.
 * - Every court created by this spec is deleted in afterAll, and leftover
 *   `E2E *` courts from earlier spec versions are swept in beforeAll — the
 *   owner dashboard is never polluted.
 * - The browser prefill test runs FIRST because it needs a WAITING court;
 *   it binds court1 without ever starting a match, so court1 is still
 *   WAITING when the protocol test plays match 1 on it.
 *
 * Run: pnpm --filter server run test:e2e -- --grep bracketCourtFlow
 */

import { test, expect } from '@playwright/test';
import { io, type Socket } from 'socket.io-client';
import { SocketEvents } from '../../shared/events';
import type { TournamentBracket } from '../../shared/types';

const BASE_URL = 'https://localhost:3000';

const PLAYERS = {
  match1A: 'Juan Pérez',
  match1B: 'María López',
  match2A: 'Carlos Ruiz',
  match2B: 'Ana Gómez',
} as const;

const START_MATCH_CONFIG = {
  bestOf: 3,
  pointsPerSet: 11,
  handicapA: 0,
  handicapB: 0,
} as const;

/** How many RECORD_POINT emits a best-of-3, 11pt match takes to finish: 11 + 11. */
const POINTS_TO_WIN = 22;

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

/**
 * Track every BRACKET_STATE on a socket and allow waiting for a state that
 * matches a predicate. The `latest` cache makes waits race-safe: callers may
 * register the wait before OR after the mutation that produces the state.
 */
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

/**
 * Create a tournament court over the protocol and capture id + pin.
 * CREATE_COURT is rate-limited server-side (5/min/IP). On RATE_LIMITED we
 * wait out the full 60s rolling window (each blocked attempt is itself
 * recorded by the limiter) before retrying.
 */
async function createCourt(
  socket: Socket,
  name: string,
  maxAttempts = 3,
): Promise<{ id: string; pin: string; name: string }> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const created = await new Promise<{ id?: string; pin?: string; name?: string }>(
        (resolve, reject) => {
          const onCreated = (court: { id?: string; pin?: string; name?: string }) => {
            cleanup();
            resolve(court);
          };
          const onError = (err: { code?: string; message?: string }) => {
            cleanup();
            reject(new Error(`CREATE_COURT error: ${err.code ?? 'UNKNOWN'} ${err.message ?? ''}`));
          };
          const cleanup = () => {
            socket.off(SocketEvents.SERVER.COURT_CREATED, onCreated as never);
            socket.off(SocketEvents.SERVER.ERROR, onError as never);
          };
          socket.once(SocketEvents.SERVER.COURT_CREATED, onCreated as never);
          socket.once(SocketEvents.SERVER.ERROR, onError as never);
          socket.emit(SocketEvents.CLIENT.CREATE_COURT, { name });
        },
      );
      if (!created.id || !created.pin) throw new Error('COURT_CREATED missing id/pin');
      return { id: created.id, pin: created.pin, name: created.name ?? name };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (!lastError.message.includes('RATE_LIMITED')) throw lastError;
      // Wait out the whole window so prior recorded attempts age out.
      await new Promise((resolve) => setTimeout(resolve, 61_000));
    }
  }
  throw lastError ?? new Error(`createCourt(${name}) exhausted retries`);
}

/** Authenticate `socket` as referee for `courtId` using its 4-digit PIN. */
async function authReferee(socket: Socket, courtId: string, courtPin: string): Promise<void> {
  const set = once(socket, SocketEvents.SERVER.REF_SET);
  socket.emit(SocketEvents.CLIENT.SET_REF, { courtId, pin: courtPin });
  await set;
}

/** Start a TT match and then play a 2-0 sweep for player 'A'. */
async function playSweepForA(
  ref: Socket,
  courtId: string,
  playerNameA: string,
  playerNameB: string,
): Promise<void> {
  ref.emit(SocketEvents.CLIENT.START_MATCH, {
    courtId,
    playerNameA,
    playerNameB,
    ...START_MATCH_CONFIG,
  });
  const matchWon = once(ref, SocketEvents.SERVER.MATCH_WON);
  for (let i = 0; i < POINTS_TO_WIN; i++) {
    ref.emit(SocketEvents.CLIENT.RECORD_POINT, { courtId, player: 'A' });
  }
  await matchWon;
}

// ── shared setup ─────────────────────────────────────────────────────────

/** Delete a court if it still exists; never throws (best-effort cleanup). */
async function deleteCourtBestEffort(socket: Socket, courtId: string): Promise<void> {
  try {
    // COURT_DELETED is emitted only to the deleted court's room; the owner
    // socket observes deletion via the global COURT_LIST broadcast instead.
    const confirmed = once(socket, SocketEvents.SERVER.COURT_LIST, 8_000);
    socket.emit(SocketEvents.CLIENT.DELETE_COURT, { courtId });
    await confirmed;
  } catch {
    // Court may already be gone — never fail the suite over cleanup.
  }
}

/** List courts visible to the owner (with pins). */
async function listOwnerCourts(socket: Socket, pin: string): Promise<Array<{ id?: string; name?: string }>> {
  const listed = once<{ courts?: Array<{ id?: string; name?: string }> }>(
    socket,
    SocketEvents.SERVER.COURT_LIST_WITH_PINS,
  );
  socket.emit(SocketEvents.CLIENT.GET_COURTS_WITH_PINS, { ownerPin: pin });
  return (await listed).courts ?? [];
}

/**
 * Sweep leftover courts from PREVIOUS spec runs. Earlier versions of this
 * spec never cleaned up after themselves, so a dev server can accumulate
 * "E2E Court …" courts. Only courts named `E2E *` are removed — real courts
 * are never touched.
 */
async function sweepLeftoverE2ECourts(socket: Socket, pin: string): Promise<void> {
  const courts = await listOwnerCourts(socket, pin);
  const leftovers = courts.filter((c) => c.name?.startsWith('E2E '));
  for (const court of leftovers) {
    if (court.id) await deleteCourtBestEffort(socket, court.id);
  }
}

let ownerSocket: Socket;
let tracker: ReturnType<typeof trackBracket>;
let court1: { id: string; pin: string; name: string };
let court2: { id: string; pin: string; name: string };
let court3: { id: string; pin: string; name: string };
let court4: { id: string; pin: string; name: string };

test.beforeAll(async () => {
  test.setTimeout(180_000);
  const owner = await connectOwner();
  ownerSocket = owner.socket;
  tracker = trackBracket(ownerSocket);
  // Clean leftovers from earlier spec versions before creating fresh courts.
  await sweepLeftoverE2ECourts(ownerSocket, owner.pin);
  await resetBracket(ownerSocket, tracker);
  // One-time court creation (rate-limited server-side, 5/min), shared by both
  // tests: court1/court2 = semifinals, court3 = final, court4 = third place.
  const suffix = Date.now();
  court1 = await createCourt(ownerSocket, `E2E Court M1 ${suffix}`);
  court2 = await createCourt(ownerSocket, `E2E Court M2 ${suffix}`);
  court3 = await createCourt(ownerSocket, `E2E Court M3 ${suffix}`);
  court4 = await createCourt(ownerSocket, `E2E Court M4 ${suffix}`);
});

test.afterAll(async () => {
  // Cleanup: remove the courts this run created so repeated runs do not
  // pollute the owner dashboard (DELETE_COURT accepts the owner socket).
  for (const court of [court1, court2, court3, court4]) {
    if (court?.id) await deleteCourtBestEffort(ownerSocket, court.id);
  }
  ownerSocket?.disconnect();
});

// ── tests ────────────────────────────────────────────────────────────────

test.describe('bracket ↔ court integration (Option 2)', () => {
  // Runs FIRST: needs a WAITING court. It binds court1 and never starts a
  // match, so court1 is still WAITING for the protocol test below.
  test('browser: MatchConfigModal prefills bracket names on a bound court', async ({ page }) => {
    test.setTimeout(90_000);

    await resetBracket(ownerSocket, tracker);

      // ── set up a bound court over the protocol ───────────────────────────
      const created = tracker.waitFor(
        (b) => b !== null && b.status === 'SETUP',
        'bracket SETUP after create',
      );
      ownerSocket.emit(SocketEvents.CLIENT.BRACKET_CREATE, {
        name: `E2E Prefill ${Date.now()}`,
        numSlots: 4,
        includeThirdPlace: true,
      });
      await created;

      const p1a = tracker.waitFor(
        (b) => matchById(b, 'R1-M1')?.playerA === PLAYERS.match1A,
        'R1-M1 playerA',
      );
      ownerSocket.emit(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, {
        matchId: 'R1-M1',
        slot: 'A',
        name: PLAYERS.match1A,
      });
      await p1a;

      const p1b = tracker.waitFor(
        (b) => matchById(b, 'R1-M1')?.playerB === PLAYERS.match1B,
        'R1-M1 playerB',
      );
      ownerSocket.emit(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, {
        matchId: 'R1-M1',
        slot: 'B',
        name: PLAYERS.match1B,
      });
      await p1b;

      const bound = tracker.waitFor(
        (b) => matchById(b, 'R1-M1')?.courtId === court1.id,
        'R1-M1 bound to court1',
      );
      ownerSocket.emit(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, {
        matchId: 'R1-M1',
        courtId: court1.id,
      });
      await bound;

      // ── real browser: referee flow → scoreboard → config modal ───────────
      await page.goto(`${BASE_URL}/auth`, { waitUntil: 'domcontentloaded' });
      // Button label depends on browser locale ("Referee" vs "Árbitro").
      await page.getByRole('button', { name: /Referee|Árbitro/ }).click();

      // Referee dashboard — pick the freshly created (WAITING) court.
      const courtCard = page.getByText(court1.name, { exact: true });
      await expect(courtCard).toBeVisible({ timeout: 15_000 });
      await courtCard.click();

      // PIN modal — enter the court's 4-digit PIN and confirm.
      const pinInput = page.locator('input[type="password"]');
      await expect(pinInput).toBeVisible({ timeout: 10_000 });
      await pinInput.fill(court1.pin);
      await page.getByRole('dialog').getByRole('button', { name: /Enter|Ingresar/ }).click();

      // Scoreboard — the config modal should open (court is WAITING) and the
      // player inputs MUST be prefilled from the bracket. Empty inputs mean
      // the stale-bundle regression is present → the test fails on purpose.
      await expect(page).toHaveURL(new RegExp(`/scoreboard/${court1.id}/referee`), {
        timeout: 15_000,
      });
      const playerA = page.locator('#player-a-name');
      const playerB = page.locator('#player-b-name');
      await expect(playerA).toBeVisible({ timeout: 15_000 });
      await expect(playerA).toHaveValue(PLAYERS.match1A);
      await expect(playerB).toHaveValue(PLAYERS.match1B);

      // ── cleanup ───────────────────────────────────────────────────────────
      await resetBracket(ownerSocket, tracker);
    // ownerSocket is shared with the protocol test — left connected, torn
    // down in afterAll.
  });

  test('protocol flow: bound court match wins auto-advance the bracket', async () => {
    test.setTimeout(90_000);
    const ref = await connectClient();

    try {
      // Clean slate — a previous run may have left a bracket behind.
      await resetBracket(ownerSocket, tracker);

      // ── create bracket (4 slots + third place) ──────────────────────────
      const created = tracker.waitFor(
        (b) => b !== null && b.status === 'SETUP',
        'bracket SETUP after create',
      );
      ownerSocket.emit(SocketEvents.CLIENT.BRACKET_CREATE, {
        name: `E2E ${Date.now()}`,
        numSlots: 4,
        includeThirdPlace: true,
      });
      const bracket = (await created)!;
      expect(bracket.matches.filter((m) => m.round === 1)).toHaveLength(2);
      expect(matchById(bracket, 'R1-M1')).not.toBeNull();
      expect(matchById(bracket, 'R1-M2')).not.toBeNull();
      expect(matchById(bracket, 'R2-M1')).not.toBeNull();
      expect(bracket.thirdPlaceMatch?.id).toBe('TP-M1');

      // ── assign players ───────────────────────────────────────────────────
      const p1a = tracker.waitFor(
        (b) => matchById(b, 'R1-M1')?.playerA === PLAYERS.match1A,
        'R1-M1 playerA',
      );
      ownerSocket.emit(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, {
        matchId: 'R1-M1',
        slot: 'A',
        name: PLAYERS.match1A,
      });
      await p1a;

      const p1b = tracker.waitFor(
        (b) => matchById(b, 'R1-M1')?.playerB === PLAYERS.match1B,
        'R1-M1 playerB',
      );
      ownerSocket.emit(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, {
        matchId: 'R1-M1',
        slot: 'B',
        name: PLAYERS.match1B,
      });
      await p1b;

      const p2a = tracker.waitFor(
        (b) => matchById(b, 'R1-M2')?.playerA === PLAYERS.match2A,
        'R1-M2 playerA',
      );
      ownerSocket.emit(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, {
        matchId: 'R1-M2',
        slot: 'A',
        name: PLAYERS.match2A,
      });
      await p2a;

      const p2b = tracker.waitFor(
        (b) => matchById(b, 'R1-M2')?.playerB === PLAYERS.match2B,
        'R1-M2 playerB',
      );
      ownerSocket.emit(SocketEvents.CLIENT.BRACKET_ASSIGN_PLAYER, {
        matchId: 'R1-M2',
        slot: 'B',
        name: PLAYERS.match2B,
      });
      await p2b;

      // ── bind the shared courts to the semifinals ────────────────────────
      const bound1 = tracker.waitFor(
        (b) => matchById(b, 'R1-M1')?.courtId === court1.id,
        'R1-M1 bound to court1',
      );
      ownerSocket.emit(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, {
        matchId: 'R1-M1',
        courtId: court1.id,
      });
      await bound1;

      const bound2 = tracker.waitFor(
        (b) => matchById(b, 'R1-M2')?.courtId === court2.id,
        'R1-M2 bound to court2',
      );
      ownerSocket.emit(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, {
        matchId: 'R1-M2',
        courtId: court2.id,
      });
      await bound2;

      // ── referee match 1 on court1: Juan beats María 2-0 ──────────────────
      await authReferee(ref, court1.id, court1.pin);
      const m1Won = tracker.waitFor(
        (b) => matchById(b, 'R1-M1')?.status === 'COMPLETED',
        'R1-M1 COMPLETED after court match',
      );
      await playSweepForA(ref, court1.id, PLAYERS.match1A, PLAYERS.match1B);
      const after1 = (await m1Won)!;

      expect(matchById(after1, 'R1-M1')?.winner).toBe('A');
      expect(matchById(after1, 'R2-M1')?.playerA).toBe(PLAYERS.match1A);
      expect(after1.thirdPlaceMatch?.playerA).toBe(PLAYERS.match1B);

      // ── referee match 2 on court2: Carlos beats Ana 2-0 ──────────────────
      await authReferee(ref, court2.id, court2.pin);
      const m2Won = tracker.waitFor(
        (b) => matchById(b, 'R1-M2')?.status === 'COMPLETED',
        'R1-M2 COMPLETED after court match',
      );
      await playSweepForA(ref, court2.id, PLAYERS.match2A, PLAYERS.match2B);
      const after2 = (await m2Won)!;

      expect(matchById(after2, 'R2-M1')?.playerB).toBe(PLAYERS.match2A);
      expect(after2.thirdPlaceMatch?.playerB).toBe(PLAYERS.match2B);
      expect(after2.status).toBe('ACTIVE');

      // ── bind the final (R2-M1) and the third-place match (TP-M1) ──────────
      const boundFinal = tracker.waitFor(
        (b) => matchById(b, 'R2-M1')?.courtId === court3.id,
        'R2-M1 bound to court3',
      );
      ownerSocket.emit(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, {
        matchId: 'R2-M1',
        courtId: court3.id,
      });
      await boundFinal;

      const boundTP = tracker.waitFor(
        (b) => b?.thirdPlaceMatch?.courtId === court4.id,
        'TP-M1 bound to court4',
      );
      ownerSocket.emit(SocketEvents.CLIENT.BRACKET_ASSIGN_COURT, {
        matchId: 'TP-M1',
        courtId: court4.id,
      });
      await boundTP;

      // ── final on court3: Juan beats Carlos 2-0 → bracket COMPLETED ───────
      await authReferee(ref, court3.id, court3.pin);
      const finalWon = tracker.waitFor(
        (b) => matchById(b, 'R2-M1')?.status === 'COMPLETED',
        'R2-M1 COMPLETED after final',
      );
      await playSweepForA(ref, court3.id, PLAYERS.match1A, PLAYERS.match2A);
      const afterFinal = (await finalWon)!;

      expect(matchById(afterFinal, 'R2-M1')?.winner).toBe('A');
      expect(afterFinal.status).toBe('COMPLETED');

      // ── third place on court4: María beats Ana 2-0 ────────────────────────
      await authReferee(ref, court4.id, court4.pin);
      const tpWon = tracker.waitFor(
        (b) => b?.thirdPlaceMatch?.status === 'COMPLETED',
        'TP-M1 COMPLETED after third-place match',
      );
      await playSweepForA(ref, court4.id, PLAYERS.match1B, PLAYERS.match2B);
      const afterTP = (await tpWon)!;

      expect(afterTP.thirdPlaceMatch?.winner).toBe('A');

      // Podium derivation from the completed bracket: champion = final winner,
      // runner-up = final loser, third place = TP winner.
      expect(matchById(afterTP, 'R2-M1')?.playerA).toBe(PLAYERS.match1A); // champion
      expect(matchById(afterTP, 'R2-M1')?.playerB).toBe(PLAYERS.match2A); // runner-up
      expect(afterTP.thirdPlaceMatch?.playerA).toBe(PLAYERS.match1B); // third place

      // ── cleanup: leave the server in a clean bracket state ───────────────
      await resetBracket(ownerSocket, tracker);
    } finally {
      ref.disconnect();
    }
  });
});
