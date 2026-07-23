/**
 * CSV export route tests — `/api/club/sessions/export`.
 *
 * Spec: club-session-history / "CSV Export" requirement.
 *
 * Coverage:
 *   - Header row matches the expected 6 columns.
 *   - Rows are emitted for each persisted SessionRecord.
 *   - Empty store → CSV contains ONLY the header row.
 *   - CSV injection prevention: leading =, +, -, @ prefixed with single
 *     quote; embedded double-quotes escaped as "".
 *   - Output has Content-Type: text/csv + Content-Disposition attachment.
 *   - Auth integration: the router mounts auth middleware; non-admin
 *     callers never reach the handler (delegated to middleware — covered
 *     in clubAuth.test.ts; here we assert the router is wired with
 *     authMiddleware via structural inspection).
 */

import { createClubSessionsExportRouter, handleClubSessionsExport } from './clubSessionsExport';
import { SessionHistoryStore } from '../services/store/SessionHistoryStore';
import type { SessionRecord } from '../../../shared/types';
import type { FileSystem } from '../services/store/types';
import type { Request, Response } from 'express';

// ── Fake FileSystem ─────────────────────────────────────────────────────

function makeFs(): FileSystem & { _files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    _files: files,
    writeFileSync(path: string, data: string): void {
      files.set(path, data);
    },
    readFileSync(path: string): string {
      if (!files.has(path)) {
        throw Object.assign(
          new Error(`ENOENT: no such file or directory, open '${path}'`),
          { code: 'ENOENT' },
        );
      }
      return files.get(path)!;
    },
    renameSync(oldPath: string, newPath: string): void {
      const content = files.get(oldPath);
      if (content !== undefined) {
        files.set(newPath, content);
        files.delete(oldPath);
      }
    },
    existsSync(path: string): boolean {
      return files.has(path);
    },
    unlinkSync(path: string): void {
      files.delete(path);
    },
    mkdirSync(): string | undefined {
      return undefined;
    },
  };
}

function createStore(records: SessionRecord[]): SessionHistoryStore {
  const fs = makeFs();
  fs._files.set('data/session-history.json', JSON.stringify(records, null, 2));
  return new SessionHistoryStore(fs, 'data/session-history.json');
}

function makeRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    courtName: 'Cancha 1',
    elapsedSeconds: 1800,
    elapsedMinutes: 30,
    mode: 'match',
    cost: 1500,
    currency: 'ARS',
    timestamp: '2026-07-20T12:00:00.000Z',
    sessionId: 'uuid-' + Math.random().toString(36).slice(2),
    // player-identity neutral defaults (pre-existing tests don't exercise
    // the new fields; passed overrides win when a test cares).
    playerName: '',
    phone: '',
    endedBy: 'player',
    adminId: null,
    ...overrides,
  };
}

// ── Mock req/res ───────────────────────────────────────────────────────

function mockReq(): Request {
  return {} as unknown as Request;
}

function mockResCapture(): {
  res: Response;
  setHeader: jest.Mock;
  send: jest.Mock;
  status: jest.Mock;
} {
  const setHeader = jest.fn().mockReturnThis();
  const send = jest.fn().mockReturnThis();
  const json = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnValue({ json });
  return {
    res: { status, json, setHeader, send } as unknown as Response,
    setHeader,
    send,
    status,
  };
}

// ── Tests: handleClubSessionsExport (pure handler) ─────────────────────

describe('handleClubSessionsExport', () => {
  it('returns CSV with Content-Type text/csv + Content-Disposition attachment and the 5-column header', () => {
    const store = createStore([]);
    const { res, setHeader, send } = mockResCapture();

    handleClubSessionsExport(store, mockReq(), res);

    expect(setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="rallyos-sessions.csv"',
    );
    expect(send).toHaveBeenCalledTimes(1);
    const csv = send.mock.calls[0][0] as string;
    // Header row only (empty store).
    const lines = csv.split('\n');
    expect(lines[0]).toBe('courtName,durationMinutes,cost,currency,date');
  });

  it('returns header-only CSV when the store is empty', () => {
    const store = createStore([]);
    const { res, send } = mockResCapture();

    handleClubSessionsExport(store, mockReq(), res);

    const csv = send.mock.calls[0][0] as string;
    const lines = csv.split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe('courtName,durationMinutes,cost,currency,date');
  });

  it('returns one row per session record (triangulate 1 vs 3 records)', () => {
    const records = [
      makeRecord({ courtName: 'Cancha Uno', sessionId: 'a' }),
      makeRecord({ courtName: 'Cancha Dos', sessionId: 'b' }),
      makeRecord({ courtName: 'Cancha Tres', sessionId: 'c' }),
    ];
    const store = createStore(records);
    const { res, send } = mockResCapture();

    handleClubSessionsExport(store, mockReq(), res);

    const csv = send.mock.calls[0][0] as string;
    const lines = csv.split('\n').filter((l) => l.length > 0);
    expect(lines).toHaveLength(4); // 1 header + 3 data rows
    expect(lines[1]).toContain('Cancha Uno');
    expect(lines[2]).toContain('Cancha Dos');
    expect(lines[3]).toContain('Cancha Tres');
  });

  it('row contents reference fields: courtName, durationMinutes, cost, currency, ISO timestamp', () => {
    const records = [
      makeRecord({
        courtName: 'Cancha X',
        elapsedMinutes: 25,
        mode: 'match',
        cost: 1250,
        currency: 'ARS',
        timestamp: '2026-07-20T12:00:00.000Z',
        sessionId: 'uuid-x',
      }),
    ];
    const store = createStore(records);
    const { res, send } = mockResCapture();

    handleClubSessionsExport(store, mockReq(), res);

    const csv = send.mock.calls[0][0] as string;
    const lines = csv.split('\n').filter((l) => l.length > 0);
    expect(lines[1]).toContain('Cancha X');
    expect(lines[1]).toContain('25');
    expect(lines[1]).toContain('1250');
    expect(lines[1]).toContain('ARS');
    expect(lines[1]).toContain('2026-07-20T12:00:00.000Z');
  });

  it('CSV injection: leading "=" is prefixed with a single quote and value is double-quoted', () => {
    const records = [
      makeRecord({
        courtName: "=cmd|' /C calc'!A0",
        sessionId: 'inj-eq',
      }),
    ];
    const store = createStore(records);
    const { res, send } = mockResCapture();

    handleClubSessionsExport(store, mockReq(), res);

    const csv = send.mock.calls[0][0] as string;
    const lines = csv.split('\n').filter((l) => l.length > 0);
    expect(lines[1]).toContain("'=cmd|' /C calc'!A0");
    // The whole value must be wrapped in double quotes
    expect(lines[1]).toContain('"\'=cmd|\' /C calc\'!A0"');
  });

  it('CSV injection: leading "+", "-", "@" are each prefixed with a single quote (triangulate the 4 chars)', () => {
    const records = [
      makeRecord({ courtName: '+InjectionPlus', sessionId: 'a' }),
      makeRecord({ courtName: '-InjectionMinus', sessionId: 'b' }),
      makeRecord({ courtName: '@InjectionAt', sessionId: 'c' }),
    ];
    const store = createStore(records);
    const { res, send } = mockResCapture();

    handleClubSessionsExport(store, mockReq(), res);

    const csv = send.mock.calls[0][0] as string;
    const lines = csv.split('\n').filter((l) => l.length > 0);
    expect(lines[1]).toContain('"\'+InjectionPlus"');
    expect(lines[2]).toContain('"\'-InjectionMinus"');
    expect(lines[3]).toContain('"\'@InjectionAt"');
  });

  it('CSV injection: embedded double-quote is escaped as "" inside the quoted value', () => {
    const records = [
      makeRecord({
        courtName: 'Cancha "Uno"',
        sessionId: 'embedded-quote',
      }),
    ];
    const store = createStore(records);
    const { res, send } = mockResCapture();

    handleClubSessionsExport(store, mockReq(), res);

    const csv = send.mock.calls[0][0] as string;
    const lines = csv.split('\n').filter((l) => l.length > 0);
    expect(lines[1]).toContain('"Cancha ""Uno"""');
  });

  it('CSV injection: non-leading =,+,-,@ chars are NOT prefixed with single quote (targeted only at leading chars)', () => {
    const records = [
      makeRecord({
        courtName: 'Cancha-+1',
        sessionId: 'internal-only',
      }),
    ];
    const store = createStore(records);
    const { res, send } = mockResCapture();

    handleClubSessionsExport(store, mockReq(), res);

    const csv = send.mock.calls[0][0] as string;
    const lines = csv.split('\n').filter((l) => l.length > 0);
    // The internal -+ chars are preserved as-is; only LEADING dangerous
    // chars get the single-quote prefix.
    expect(lines[1]).toContain('Cancha-+1');
    expect(lines[1]).not.toContain("'Cancha");
  });
});

// ── Tests: createClubSessionsExportRouter ───────────────────────────────

describe('createClubSessionsExportRouter', () => {
  it('mounts a single GET / route wrapped with the provided auth middleware', () => {
    const store = createStore([]);
    const router = createClubSessionsExportRouter(
      store,
      (req, res, next) => next(),
    );

    const stack = (router as any).stack;
    expect(stack).toBeDefined();
    expect(stack.length).toBe(1);
    const route = stack[0].route;
    expect(route.path).toBe('/');
    expect(route.methods.get).toBe(true);
  });

  it('wires auth middleware before the handler (structural check — non-admin rejection is middleware-tested in clubAuth.test.ts)', () => {
    const store = createStore([
      makeRecord({ courtName: 'Cancha Sensitive', sessionId: 's' }),
    ]);
    let authCalled = false;
    const authMiddleware = (req: any, res: any, next: any) => {
      authCalled = true;
      next();
    };

    const router = createClubSessionsExportRouter(store, authMiddleware);
    const stack = (router as any).stack;
    expect(stack).toBeDefined();
    expect(stack.length).toBe(1);
    const layer = stack[0];
    // Express wraps route handlers as a chain: the get / route's stack
    // has [authMiddleware, handler].
    expect(layer.route.stack.length).toBeGreaterThanOrEqual(2);
    // First handler in the chain is the auth middleware.
    expect(layer.route.stack[0].handle).toBe(authMiddleware);
  });
});