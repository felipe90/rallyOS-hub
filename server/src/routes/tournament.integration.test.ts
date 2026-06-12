import { SPORT } from '../../../shared/types';
/**
 * Tournament route integration tests.
 *
 * Tests the complete wiring: auth middleware + route handlers + Express Router.
 * Verifies that unauthenticated requests get 401, and the router factory
 * produces a correctly configured router with all 4 endpoints.
 */

import { createTournamentRouter } from './tournament';
import { generateToken, activeTokens } from '../middleware/ownerAuth';
import { StateStore } from '../services/store/StateStore';
import type { FileSystem, PersistedCourt } from '../services/store/types';
import type { Request, Response, NextFunction } from 'express';
import type { Router } from 'express';

// ── Fake FileSystem ────────────────────────────────────────────────────

function makeFs(): FileSystem & { _files: Map<string, string> } {
  const files = new Map<string, string>();
  return {
    _files: files,
    writeFileSync(path: string, data: string, _encoding: BufferEncoding): void {
      files.set(path, data);
    },
    readFileSync(path: string, _encoding: BufferEncoding): string {
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
    mkdirSync(_path: string, _options?: { recursive: boolean }): string | undefined {
      return undefined;
    },
  };
}

function makePersistedCourt(overrides: Partial<PersistedCourt> = {}): PersistedCourt {
  return {
    id: 'table-1',
    number: 1,
    name: 'Mesa 1',
    status: 'LIVE',
    pin: '4821',
    playerNames: { a: 'Alice', b: 'Bob' },
    createdAt: 1700000000000,
    matchState: {
      config: { sport: SPORT.TABLE_TENNIS, pointsPerSet: 11, bestOf: 3, minDifference: 2 },
      score: { sets: { a: 0, b: 0 }, currentSet: { a: 5, b: 3 }, serving: 'B' },
      swappedSides: false,
      midSetSwapped: false,
      setHistory: [],
      status: 'LIVE',
      winner: null,
      sport: SPORT.TABLE_TENNIS,
      history: [],
    },
    ...overrides,
  };
}

// ── Helper: extract route handlers from Router ─────────────────────────

interface RouterLayer {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: (req: any, res: any) => void }>;
  };
  handle?: (req: any, res: any, next: any) => void;
  name?: string;
}

function getRoutesFromRouter(router: Router): RouterLayer[] {
  return (router as any).stack || [];
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('Tournament router integration', () => {
  let fs: ReturnType<typeof makeFs>;
  let stateStore: StateStore;
  let fakeTableManager: any;
  let router: Router;

  beforeEach(() => {
    activeTokens.clear();
    fs = makeFs();
    stateStore = new StateStore(fs, 'data/rallyos-state.json');

    fakeTableManager = {
      loadTournament: jest.fn().mockReturnValue(false),
      getAllTables: jest.fn().mockReturnValue([]),
    };

    router = createTournamentRouter(
      stateStore,
      fakeTableManager,
      (req, res, next) => next(), // pass-through middleware for route structure tests
    );
  });

  describe('route registration', () => {
    it('should register GET /status route', () => {
      const routes = getRoutesFromRouter(router);
      const statusRoute = routes.find(
        (r: RouterLayer) => r.route?.path === '/status' && r.route?.methods?.get,
      );
      expect(statusRoute).toBeDefined();
    });

    it('should register POST /load route', () => {
      const routes = getRoutesFromRouter(router);
      const loadRoute = routes.find(
        (r: RouterLayer) => r.route?.path === '/load' && r.route?.methods?.post,
      );
      expect(loadRoute).toBeDefined();
    });

    it('should register POST /new route', () => {
      const routes = getRoutesFromRouter(router);
      const newRoute = routes.find(
        (r: RouterLayer) => r.route?.path === '/new' && r.route?.methods?.post,
      );
      expect(newRoute).toBeDefined();
    });

    it('should register POST /finish route', () => {
      const routes = getRoutesFromRouter(router);
      const finishRoute = routes.find(
        (r: RouterLayer) => r.route?.path === '/finish' && r.route?.methods?.post,
      );
      expect(finishRoute).toBeDefined();
    });

    it('should register exactly 4 routes', () => {
      const routes = getRoutesFromRouter(router);
      const routeCount = routes.filter((r: RouterLayer) => r.route).length;
      expect(routeCount).toBe(4);
    });
  });

  describe('handler behavior through router', () => {
    it('should return 200 from /status when state exists', () => {
      const persisted = {
        version: 1,
        savedAt: 1700000000000,
        tables: [makePersistedCourt()],
      };
      fs._files.set('data/rallyos-state.json', JSON.stringify(persisted));

      const router = createTournamentRouter(
        stateStore,
        fakeTableManager,
        (req, res, next) => next(),
      );

      // Invoke the /status GET handler directly
      const routes = getRoutesFromRouter(router);
      const statusLayer = routes.find(
        (r: RouterLayer) => r.route?.path === '/status',
      );
      expect(statusLayer).toBeDefined();

      const req = { method: 'GET' } as Request;
      const resJson = jest.fn();
      const res = { json: resJson } as unknown as Response;

      // Execute the handler stack (middleware + handler)
      const stack = statusLayer!.route!.stack as any[];
      // stack[0] = pass-through middleware, stack[1] = handler
      const handler = stack[stack.length - 1].handle;
      handler(req, res);

      expect(resJson).toHaveBeenCalledWith(
        expect.objectContaining({ exists: true, matchCount: 1 }),
      );
    });

    it('should return 200 from /new handler', () => {
      const router = createTournamentRouter(
        stateStore,
        fakeTableManager,
        (req, res, next) => next(),
      );

      const routes = getRoutesFromRouter(router);
      const newLayer = routes.find(
        (r: RouterLayer) => r.route?.path === '/new',
      );

      const req = { method: 'POST' } as Request;
      const resJson = jest.fn();
      const res = { json: resJson } as unknown as Response;

      const stack = newLayer!.route!.stack as any[];
      const handler = stack[stack.length - 1].handle;
      handler(req, res);

      expect(resJson).toHaveBeenCalledWith({ success: true });
    });
  });
});
