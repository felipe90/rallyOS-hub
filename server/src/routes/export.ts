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

const csvExporter = new CsvExporter();

/**
 * GET /
 * Returns a CSV of all FINISHED tables from the state store.
 *
 * Reads persisted state, filters to FINISHED tables, generates CSV,
 * and sets appropriate headers for file download.
 */
export function handleExport(
  stateStore: ICourtPersistence,
  _req: Request,
  res: Response,
): void {
  const loaded = stateStore.load();
  const tables = loaded?.tournamentCourts ?? [];

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
