/**
 * CSV Export HTTP endpoint.
 *
 * Exposes GET /api/export/matches.csv — returns finished matches as CSV.
 * Protected by owner auth middleware.
 *
 * Design: Handler function exported for unit testing. Factory function
 * creates an Express Router with auth middleware injected.
 */

import { Router, Request, Response } from 'express';
import { CsvExporter } from '../services/store/CsvExporter';
import type { ICourtPersistence } from '../domain/ports';
import type { PersistedCourt, PersistedMatchState } from '../domain/ports/persistence-types';

const csvExporter = new CsvExporter();

/**
 * GET /
 * Returns a CSV of all FINISHED tournament matches from the state store.
 *
 * Reads the v4 `liveSessions` rows (PERS-2), filters to tournament-mode
 * sessions whose match state is FINISHED, maps them back into the
 * PersistedCourt row shape the CsvExporter consumes, and sets the
 * download headers. Identity fields (number/name) come from the session
 * snapshot (written at serialize time from the catalog record).
 */
export function handleExport(
  stateStore: ICourtPersistence,
  _req: Request,
  res: Response,
): void {
  const loaded = stateStore.load();
  const sessions = loaded?.liveSessions ?? [];

  const tables: PersistedCourt[] = sessions
    .filter(
      (s) =>
        s.flow?.mode === 'tournament' &&
        (s.matchState as { status?: string } | null)?.status === 'FINISHED',
    )
    .map((s) => ({
      id: s.courtId,
      number: s.number ?? 0,
      name: s.name ?? s.courtId,
      status: 'FINISHED' as const,
      pin: s.pin ?? '',
      playerNames: s.playerNames ?? { a: '', b: '' },
      createdAt: s.createdAt ?? 0,
      matchState: (s.matchState as unknown as PersistedMatchState) ?? null,
    }))
    .filter((t) => t.matchState !== null);

  const csv = csvExporter.export(tables);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="rallyos-matches.csv"',
  );
  res.send(csv);
}

/**
 * Creates an Express Router with the CSV export endpoint.
 * The route is wrapped with owner auth middleware.
 *
 * @param stateStore  StateStore instance for reading persisted tables.
 * @param authMiddleware  Express middleware for owner auth validation.
 * @returns  Configured Express Router.
 */
export function createExportRouter(
  stateStore: ICourtPersistence,
  authMiddleware: (req: Request, res: Response, next: () => void) => void,
): Router {
  const router = Router();

  router.get('/', authMiddleware, (req: Request, res: Response) => {
    handleExport(stateStore, req, res);
  });

  return router;
}
