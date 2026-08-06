/**
 * Tournament lifecycle HTTP endpoints.
 *
 * All routes require owner auth (valid tournament token).
 * Provides status, load, new, and finish operations.
 *
 * Design: Dependencies (StateStore, CourtManager) are injected via
 * the factory function `createTournamentRouter`. Handler functions
 * are also exported for unit testing in isolation.
 */

import { Router, Request, Response } from 'express';
import type { CourtManager } from '../domain/courtManager';
import type { ICourtPersistence } from '../domain/ports';

/**
 * GET /status
 * Returns whether a persisted tournament exists and how many tables it contains.
 */
export function handleStatus(
  stateStore: ICourtPersistence,
  _req: Request,
  res: Response,
): void {
  const loaded = stateStore.load();

  // v4 shape: tournament match count = tournament-mode LIVE/FINISHED sessions.
  const tournamentSessions = (loaded?.liveSessions ?? []).filter(
    (s) => s.flow?.mode === 'tournament',
  );

  if (tournamentSessions.length === 0) {
    res.json({
      exists: false,
      matchCount: 0,
      lastSaved: null,
    });
    return;
  }

  res.json({
    exists: true,
    matchCount: tournamentSessions.length,
    lastSaved: new Date(loaded!.savedAt).toISOString(),
  });
}

/**
 * POST /load
 * Restores tables from persisted state via CourtManager.restoreState().
 */
export function handleLoad(
  stateStore: ICourtPersistence,
  tableManager: CourtManager,
  _req: Request,
  res: Response,
): void {
  const success = tableManager.restoreState();

  if (!success) {
    res.status(409).json({
      error: 'No hay torneo previo',
      code: 'NO_STATE',
    });
    return;
  }

  const restored = tableManager.getAllCourts().length;

  res.json({ restored });
}

/**
 * POST /new
 * Discards any persisted tournament state. Idempotent.
 */
export function handleNew(
  stateStore: ICourtPersistence,
  _req: Request,
  res: Response,
): void {
  stateStore.clear();
  res.json({ success: true });
}

/**
 * POST /finish
 * Clears the active tournament state.
 *
 * Slice 4 (TCS-3/Q4): when a bracket release seam is wired, every bracket
 * court binding is released first (flows → IDLE, bracket kept for display);
 * club courts are never touched. The finished bracket stays rendered.
 */
export function handleFinish(
  stateStore: ICourtPersistence,
  tableManager: CourtManager,
  _req: Request,
  res: Response,
  releaseAllBracketCourts?: () => string[],
): void {
  if (!stateStore.checkExists()) {
    res.status(409).json({
      error: 'No hay torneo activo',
      code: 'NO_ACTIVE_TOURNAMENT',
    });
    return;
  }

  // TCS-3/Q4 — release bracket-scoped court bindings + tournament flows
  // BEFORE finishTournament clears the runtime tournament entries.
  releaseAllBracketCourts?.();

  stateStore.clear();
  tableManager.finishTournament();

  res.json({ success: true });
}

/**
 * Creates an Express Router with all tournament lifecycle endpoints.
 * Each route is wrapped with the owner auth middleware.
 *
 * @param stateStore  StateStore instance for persistence operations.
 * @param tableManager  CourtManager instance for tournament restoration.
 * @param authMiddleware  Express middleware for owner auth validation.
 * @param releaseAllBracketCourts  Optional bracket release seam (TCS-3/Q4) —
 *   wired from the SocketHandler so POST /finish unbinds bracket courts.
 * @returns  Configured Express Router.
 */
export function createTournamentRouter(
  stateStore: ICourtPersistence,
  tableManager: CourtManager,
  authMiddleware: (req: Request, res: Response, next: () => void) => void,
  releaseAllBracketCourts?: () => string[],
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
    handleFinish(stateStore, tableManager, req, res, releaseAllBracketCourts);
  });

  return router;
}
