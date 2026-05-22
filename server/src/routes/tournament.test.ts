/**
 * Tournament route handler tests.
 *
 * Tests each handler function in isolation using fake StateStore/TableManager.
 * The auth middleware is tested separately in ownerAuth.test.ts.
 */

import {
  handleStatus,
  handleLoad,
  handleNew,
  handleFinish,
} from './tournament';
import { StateStore } from '../services/store/StateStore';
import type { FileSystem, PersistedTable } from '../services/store/types';
import type { Request, Response } from 'express';

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

// ── Mock req/res ────────────────────────────────────────────────────────

function mockReq(): Request {
  return {} as unknown as Request;
}

function mockRes(): { res: Response; status: jest.Mock; json: jest.Mock; sent: any } {
  const json = jest.fn().mockReturnThis();
  const status = jest.fn().mockReturnValue({ json });
  return {
    res: { status, json } as unknown as Response,
    status,
    json,
    sent: undefined,
  };
}

// ── Fake TableManager (only loadTournament needed) ─────────────────────

function makeFakeTableManager(restoredCount: number) {
  return {
    loadTournament: jest.fn().mockReturnValue(restoredCount > 0),
    getAllTables: jest.fn().mockReturnValue(
      Array.from({ length: restoredCount }, (_, i) => ({
        id: `table-${i}`,
        number: i + 1,
        name: `Table ${i + 1}`,
        status: 'LIVE',
      })),
    ),
  } as any;
}

// ── Helpers ────────────────────────────────────────────────────────────

function makeTable(overrides: Partial<PersistedTable> = {}): PersistedTable {
  return {
    id: 'table-1',
    number: 1,
    name: 'Mesa 1',
    status: 'LIVE',
    pin: '4821',
    playerNames: { a: 'Alice', b: 'Bob' },
    createdAt: 1700000000000,
    matchState: {
      config: { pointsPerSet: 11, bestOf: 3, minDifference: 2 },
      score: {
        sets: { a: 0, b: 0 },
        currentSet: { a: 5, b: 3 },
        serving: 'B',
      },
      swappedSides: false,
      midSetSwapped: false,
      setHistory: [],
      status: 'LIVE',
      winner: null,
      history: [],
    },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('Tournament route handlers', () => {
  describe('handleStatus', () => {
    it('should return exists=true with matchCount when state file exists', () => {
      const fs = makeFs();
      const stateStore = new StateStore(fs, 'data/rallyos-state.json');

      // Seed state with 2 tables
      const persisted = {
        version: 1,
        savedAt: 1700000000000,
        tables: [makeTable({ id: 't1' }), makeTable({ id: 't2' })],
      };
      fs._files.set('data/rallyos-state.json', JSON.stringify(persisted));

      const req = mockReq();
      const { status, json } = mockRes();

      handleStatus(stateStore, req, { status, json } as unknown as Response);

      expect(status).not.toHaveBeenCalled(); // 200 is default
      expect(json).toHaveBeenCalledWith({
        exists: true,
        matchCount: 2,
        lastSaved: expect.any(String),
      });
    });

    it('should return exists=false when no state file', () => {
      const fs = makeFs();
      const stateStore = new StateStore(fs, 'data/rallyos-state.json');

      const req = mockReq();
      const { status, json } = mockRes();

      handleStatus(stateStore, req, { status, json } as unknown as Response);

      expect(json).toHaveBeenCalledWith({
        exists: false,
        matchCount: 0,
        lastSaved: null,
      });
    });

    it('should return exists=false when state file has empty tables', () => {
      const fs = makeFs();
      const stateStore = new StateStore(fs, 'data/rallyos-state.json');

      const persisted = { version: 1, savedAt: 1700000000000, tables: [] };
      fs._files.set('data/rallyos-state.json', JSON.stringify(persisted));

      const req = mockReq();
      const { status, json } = mockRes();

      handleStatus(stateStore, req, { status, json } as unknown as Response);

      expect(json).toHaveBeenCalledWith({
        exists: false,
        matchCount: 0,
        lastSaved: null,
      });
    });

    it('should return exists=false when JSON is corrupt', () => {
      const fs = makeFs();
      const stateStore = new StateStore(fs, 'data/rallyos-state.json');
      fs._files.set('data/rallyos-state.json', 'invalid-json{');

      const req = mockReq();
      const { status, json } = mockRes();

      handleStatus(stateStore, req, { status, json } as unknown as Response);

      expect(json).toHaveBeenCalledWith({
        exists: false,
        matchCount: 0,
        lastSaved: null,
      });
    });
  });

  describe('handleLoad', () => {
    it('should return restored count when tables are loaded', () => {
      const fs = makeFs();
      const stateStore = new StateStore(fs, 'data/rallyos-state.json');

      // Seed state with tables
      const persisted = {
        version: 1,
        savedAt: 1700000000000,
        tables: [makeTable({ id: 't1' }), makeTable({ id: 't2' })],
      };
      fs._files.set('data/rallyos-state.json', JSON.stringify(persisted));

      const fakeTM = makeFakeTableManager(2);
      const req = mockReq();
      const { status, json } = mockRes();

      handleLoad(stateStore, fakeTM, req, {
        status,
        json,
      } as unknown as Response);

      expect(fakeTM.loadTournament).toHaveBeenCalled();
      expect(json).toHaveBeenCalledWith({ restored: 2 });
    });

    it('should return error when no state file exists', () => {
      const fs = makeFs();
      const stateStore = new StateStore(fs, 'data/rallyos-state.json');
      const fakeTM = makeFakeTableManager(0);
      fakeTM.loadTournament.mockReturnValue(false);

      const req = mockReq();
      const { status, json } = mockRes();

      handleLoad(stateStore, fakeTM, req, {
        status,
        json,
      } as unknown as Response);

      expect(status).toHaveBeenCalledWith(409);
      expect(json).toHaveBeenCalledWith({
        error: 'No hay torneo previo',
        code: 'NO_STATE',
      });
    });

    it('should return error when state exists but loadTournament returns false', () => {
      const fs = makeFs();
      const stateStore = new StateStore(fs, 'data/rallyos-state.json');

      // State exists but loadTournament fails (e.g., all tables corrupted)
      const persisted = {
        version: 1,
        savedAt: 1700000000000,
        tables: [makeTable()],
      };
      fs._files.set('data/rallyos-state.json', JSON.stringify(persisted));

      const fakeTM = makeFakeTableManager(0);
      fakeTM.loadTournament.mockReturnValue(false);

      const req = mockReq();
      const { status, json } = mockRes();

      handleLoad(stateStore, fakeTM, req, {
        status,
        json,
      } as unknown as Response);

      expect(status).toHaveBeenCalledWith(409);
    });
  });

  describe('handleNew', () => {
    it('should clear state and return success when state exists', () => {
      const fs = makeFs();
      const stateStore = new StateStore(fs, 'data/rallyos-state.json');

      fs._files.set('data/rallyos-state.json', JSON.stringify({ version: 1, savedAt: 0, tables: [makeTable()] }));

      const req = mockReq();
      const { status, json } = mockRes();

      handleNew(stateStore, req, { status, json } as unknown as Response);

      // File should be gone
      expect(fs._files.has('data/rallyos-state.json')).toBe(false);
      expect(json).toHaveBeenCalledWith({ success: true });
    });

    it('should return success even when no state exists (idempotent)', () => {
      const fs = makeFs();
      const stateStore = new StateStore(fs, 'data/rallyos-state.json');

      const req = mockReq();
      const { status, json } = mockRes();

      handleNew(stateStore, req, { status, json } as unknown as Response);

      expect(json).toHaveBeenCalledWith({ success: true });
    });

    it('should be idempotent — calling twice does not throw', () => {
      const fs = makeFs();
      const stateStore = new StateStore(fs, 'data/rallyos-state.json');

      fs._files.set('data/rallyos-state.json', '{}');

      const req = mockReq();
      const { status, json } = mockRes();

      handleNew(stateStore, req, { status, json } as unknown as Response);
      // Second call should not throw
      expect(() =>
        handleNew(stateStore, req, {
          status,
          json,
        } as unknown as Response),
      ).not.toThrow();
    });
  });

  describe('handleFinish', () => {
    it('should archive file and clear state when tournament exists', () => {
      const fs = makeFs();
      const stateStore = new StateStore(fs, 'data/rallyos-state.json');

      const persisted = {
        version: 1,
        savedAt: 1700000000000,
        tables: [makeTable({ id: 't1' }), makeTable({ id: 't2', status: 'FINISHED' })],
      };
      fs._files.set('data/rallyos-state.json', JSON.stringify(persisted));

      const req = mockReq();
      const { status, json } = mockRes();

      handleFinish(stateStore, req, { status, json } as unknown as Response);

      // Source file should be gone (archived)
      expect(fs._files.has('data/rallyos-state.json')).toBe(false);
      // Archive should exist
      const archiveKeys = Array.from(fs._files.keys()).filter((k) =>
        k.startsWith('data/archive/torneo-'),
      );
      expect(archiveKeys.length).toBe(1);

      expect(json).toHaveBeenCalledWith({
        success: true,
        archivePath: expect.stringMatching(/^data\/archive\/torneo-.*\.json$/),
      });
    });

    it('should return error when no active tournament', () => {
      const fs = makeFs();
      const stateStore = new StateStore(fs, 'data/rallyos-state.json');

      const req = mockReq();
      const { status, json } = mockRes();

      handleFinish(stateStore, req, { status, json } as unknown as Response);

      expect(status).toHaveBeenCalledWith(409);
      expect(json).toHaveBeenCalledWith({
        error: 'No hay torneo activo',
        code: 'NO_ACTIVE_TOURNAMENT',
      });
    });

    it('should preserve archived content', () => {
      const fs = makeFs();
      const stateStore = new StateStore(fs, 'data/rallyos-state.json');

      const tables = [makeTable({ id: 't1', pin: '9999' })];
      const persisted = { version: 1, savedAt: 1700000000000, tables };
      fs._files.set('data/rallyos-state.json', JSON.stringify(persisted));

      const req = mockReq();
      const { json } = mockRes();

      handleFinish(stateStore, req, {
        status: jest.fn().mockReturnValue({ json }),
        json,
      } as unknown as Response);

      const archiveKeys = Array.from(fs._files.keys()).filter((k) =>
        k.startsWith('data/archive/'),
      );
      const archivedContent = JSON.parse(fs._files.get(archiveKeys[0])!);
      expect(archivedContent.tables).toHaveLength(1);
      expect(archivedContent.tables[0].pin).toBe('9999');
    });
  });
});
