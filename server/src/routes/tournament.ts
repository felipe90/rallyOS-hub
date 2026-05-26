/**
 * Tournament lifecycle HTTP endpoints.
 *
 * All routes require owner auth (valid tournament token).
 * Provides status, load, new, and finish operations.
 *
 * Design: Dependencies (StateStore, TableManager) are injected via
 * the factory function `createTournamentRouter`. Handler functions
 * are also exported for unit testing in isolation.
 */

import { Router, Request, Response } from 'express';
import { StateStore } from '../services/store/StateStore';
import type { TableManager } from '../domain/courtManager';

/**
 * GET /status
 * Returns whether a persisted tournament exists and how many tables it contains.
 */
export function handleStatus(
  stateStore: StateStore,
  _req: Request,
  res: Response,
): void {
  const loaded = stateStore.load();

  if (!loaded || !loaded.tables || loaded.tables.length === 0) {
    res.json({
      exists: false,
      matchCount: 0,
      lastSaved: null,
    });
    return;
  }

  res.json({
    exists: true,
    matchCount: loaded.tables.length,
    lastSaved: new Date(loaded.savedAt).toISOString(),
  });
}

/**
 * POST /load
 * Restores tables from persisted state via TableManager.loadTournament().
 */
export function handleLoad(
  stateStore: StateStore,
  tableManager: TableManager,
  _req: Request,
  res: Response,
): void {
  const success = tableManager.loadTournament();

  if (!success) {
    res.status(409).json({
      error: 'No hay torneo previo',
      code: 'NO_STATE',
    });
    return;
  }

  const restored = tableManager.getAllTables().length;

  res.json({ restored });
}

/**
 * POST /new
 * Discards any persisted tournament state. Idempotent.
 */
export function handleNew(
  stateStore: StateStore,
  _req: Request,
  res: Response,
): void {
  stateStore.clear();
  res.json({ success: true });
}

/**
 * POST /finish
 * Archives the current state file and clears active state.
 */
export function handleFinish(
  stateStore: StateStore,
  _req: Request,
  res: Response,
): void {
  if (!stateStore.checkExists()) {
    res.status(409).json({
      error: 'No hay torneo activo',
      code: 'NO_ACTIVE_TOURNAMENT',
    });
    return;
  }

  const archivePath = stateStore.archive();
  stateStore.clear();

  res.json({ success: true, archivePath });
}

/**
 * Creates an Express Router with all tournament lifecycle endpoints.
 * Each route is wrapped with the owner auth middleware.
 *
 * @param stateStore  StateStore instance for persistence operations.
 * @param tableManager  TableManager instance for tournament restoration.
 * @param authMiddleware  Express middleware for owner auth validation.
 * @returns  Configured Express Router.
 */
export function createTournamentRouter(
  stateStore: StateStore,
  tableManager: TableManager,
  authMiddleware: (req: Request, res: Response, next: () => void) => void,
): Router {
  const router = Router();

  router.get('/status', authMiddleware, (req: Request, res: Response) => {
    handleStatus(stateStore, req, res);
  });

  router.post('/load', authMiddleware, (req: Request, res: Response) => {
    handleLoad(stateStore, tableManager, req, res);
  });

  router.post('/new', authMiddleware, (req: Request, res: Response) => {
    handleNew(stateStore, req, res);
  });

  router.post('/finish', authMiddleware, (req: Request, res: Response) => {
    handleFinish(stateStore, req, res);
  });

  return router;
}
