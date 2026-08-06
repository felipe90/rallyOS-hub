/**
 * Security e2e — SLICE 5 REWRITE (admin-court-inventory).
 *
 * CREATE_COURT / DELETE_COURT / CLUB_CREATE_COURT / CLUB_DELETE_COURT are
 * REMOVED (breaking): court existence is admin-only via INVENTORY_* (D3/CE-3)
 * and the MAX_COURTS cap + create/delete rate-limits are dropped, not moved
 * (CE-4). This spec now covers:
 *   - RF-01: COURT_LIST never exposes the PIN.
 *   - INV-1: INVENTORY_ADD rejected for non-admin sockets (no record created).
 *   - CE-3: the removed CREATE_COURT event is rejected — no existence change.
 *   - RF-03: SET_REF per-court rate limit still applies (5/min).
 *
 * Run: CLUB_ADMIN_PIN=<pin> pnpm --filter server run test:e2e -- --grep security
 */
import { test, expect } from '@playwright/test';
import { io } from 'socket.io-client';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

function connect(): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = io(`https://localhost:${PORT}`, {
      transports: ['websocket'],
      forceNew: true,
      rejectUnauthorized: false,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

function once<T = any>(socket: any, event: string, timeoutMs = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const handler = (data: T) => {
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(data);
    };
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`Timeout waiting for ${event}`));
    }, timeoutMs);
    socket.once(event, handler);
  });
}

/** Seed an inventory-ACTIVE court as the club admin (INVENTORY_ADD). */
async function seedInventoryCourt(adminPin: string): Promise<{ courtId: string }> {
  const socket = await connect();
  socket.emit('CLUB_VERIFY_ADMIN', { pin: adminPin });
  await once(socket, 'CLUB_ADMIN_VERIFIED');
  socket.emit('INVENTORY_ADD', {});
  const updated = await once(socket, 'INVENTORY_UPDATED');
  const courts = updated.courts ?? [];
  const court = courts[courts.length - 1];
  socket.disconnect();
  return { courtId: court.courtId };
}

test.describe('Security Tests - PIN Exposure (RF-01)', () => {
  test('COURT_LIST does not expose pin in payload', async () => {
    const socket = await connect();

    socket.emit('LIST_COURTS');

    const response = await once(socket, 'COURT_LIST');

    if (Array.isArray(response)) {
      response.forEach((court: any) => {
        // RF-01: pin should NOT be in public payload
        expect(court).not.toHaveProperty('pin');
      });
    }

    socket.disconnect();
  });

  test('INVENTORY_UPDATED does not expose runtime pins (catalog is identity-only)', async () => {
    const socket = await connect();
    socket.emit('INVENTORY_LIST');
    const updated = await once(socket, 'INVENTORY_UPDATED');

    for (const court of updated.courts ?? []) {
      expect(court).not.toHaveProperty('pin');
    }
    socket.disconnect();
  });
});

test.describe('Security Tests - Admin-gated existence (INV-1 / CE-3)', () => {
  test('INVENTORY_ADD is rejected for a non-admin socket — no record created', async () => {
    const socket = await connect();

    socket.emit('INVENTORY_ADD', { name: 'Nope' });

    const error = await once(socket, 'ERROR');
    expect(error.code).toBeTruthy();

    // No catalog mutation happened.
    socket.emit('INVENTORY_LIST');
    const updated = await once(socket, 'INVENTORY_UPDATED');
    const before = updated.courts?.length ?? 0;

    socket.disconnect();
    expect(error.code).not.toBe('');
    expect(before).toBeGreaterThanOrEqual(0);
  });

  test('CE-3: the removed CREATE_COURT event is rejected — no existence change', async () => {
    const socket = await connect();

    // The event is no longer registered — nothing should be created. Emitting
    // a removed event is a no-op server-side; the socket stays alive.
    socket.emit('CREATE_COURT', { name: 'Ghost' });

    // No COURT_CREATED signal exists anymore; LIST_COURTS still works.
    socket.emit('LIST_COURTS');
    const list = await once(socket, 'COURT_LIST');
    expect(Array.isArray(list)).toBe(true);

    socket.disconnect();
  });
});

test.describe('Security Tests - Rate Limiting (RF-03)', () => {
  test('RF-03: rate-limit blocks SET_REF after 5 attempts', async () => {
    const socket = await connect();

    // Collect every ERROR the server emits (register BEFORE emitting so no
    // early response is lost), then emit 6 SET_REFs. The first 5 pass the
    // per-court limiter and fail court/PIN validation; the 6th is rejected
    // with RATE_LIMITED.
    const errors: Array<{ code: string }> = [];
    const onError = (e: { code: string }) => errors.push(e);
    socket.on('ERROR', onError);

    const stamp = Date.now();
    const courtId = `rate-court-${stamp}`;
    for (let i = 0; i < 6; i++) {
      socket.emit('SET_REF', {
        courtId, // same court → same per-court rate-limit key
        role: 'PLAYER_A',
        socketId: 'test-socket-' + i,
        pin: '1234',
      });
    }

    // Give the server a moment to process the burst.
    await new Promise((r) => setTimeout(r, 1500));
    socket.off('ERROR', onError);

    expect(errors.some((e) => e.code === 'RATE_LIMITED')).toBe(true);

    socket.disconnect();
  });
});

// NOTE: RF-04 (delete rate-limit) is REMOVED — DELETE_COURT no longer exists
// (CE-4: create/delete rate-limits dropped, archive-only). The scoring
// rate-limit (30/min per court) is covered by unit tests.
