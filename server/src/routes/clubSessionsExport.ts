/**
 * Club Sessions CSV Export HTTP endpoint.
 *
 * Exposes `GET /api/club/sessions/export` — returns the persisted club
 * session history as CSV. Protected by `clubAuth` middleware (role=
 * club_admin). Spec: club-session-history / "CSV Export" requirement.
 *
 * Columns: courtName, mode, durationMinutes, cost, currency, date
 *
 * CSV injection safety (spec: "CSV injection prevented"):
 *   - Every value is wrapped in double quotes.
 *   - Embedded double-quotes are escaped as "".
 *   - Leading `=`, `+`, `-`, `@` (the four spreadsheet-formula trigger
 *     characters) are prefixed with a single quote `'` inside the quotes,
 *     so spreadsheet software renders the cell as text rather than
 *     evaluating it as a formula.
 *
 * Empty store: the response contains ONLY the header row (no data rows).
 *
 * Auth: 401 (no/invalid token) and 403 (valid token, wrong role) are
 * produced by `createClubAuthMiddleware` — this route just wires it in.
 *
 * Design: `handleClubSessionsExport` is exported as a pure function for
 * unit testing (decoupled from Express routing). `createClubSessionsExportRouter`
 * is the factory that assembles the router with auth middleware injected.
 */

import { Router, Request, Response } from 'express';
import type { SessionHistoryStore } from '../services/store/SessionHistoryStore';
import type { SessionRecord } from '../../../shared/types';

const CSV_HEADER = 'courtName,mode,durationMinutes,cost,currency,date';

// Characters that, when leading a spreadsheet cell, trigger formula
// evaluation in Excel/LibreOffice/Sheets. Prefixing with a single quote
// forces text rendering.
const DANGEROUS_LEADING_CHARS = new Set(['=', '+', '-', '@']);

/**
 * CSV-escape a single value: wrap in double quotes, escape embedded
 * double-quotes as `""`, and prefix a single leading `=`, `+`, `-`, or `@`
 * with `'` to neutralize spreadsheet formula injection.
 *
 * Pure — no I/O. Extracted for testability + to keep injection-safety
 * garantiabce visible to the security audit.
 */
export function csvEscape(value: string | number): string {
  const str = typeof value === 'number' ? String(value) : (value ?? '');

  // Prefix a single `'` before a leading dangerous char. Done before
  // double-quote escaping so the prefix is inside the quotes.
  let escaped = '';
  if (str.length > 0 && DANGEROUS_LEADING_CHARS.has(str[0])) {
    escaped = "'" + str;
  } else {
    escaped = str;
  }

  // Double every embedded double-quote (CSV-RFC-4180 escape inside quoted cells).
  const quoted = escaped.replace(/"/g, '""');

  return `"${quoted}"`;
}

/**
 * Build the CSV body from a list of session records. One row per record,
 * sorted as provided by the caller (the session-history store returns the
 * persisted order — append-order). The 6-column header is always present.
 *
 * Pure — no I/O. Exported for unit testing of the CSV transformation in
 * isolation from the route plumbing.
 */
export function buildSessionCsv(records: SessionRecord[]): string {
  const rows = records.map((r) => [
    csvEscape(r.courtName),
    csvEscape(r.mode),
    csvEscape(r.elapsedMinutes),
    csvEscape(r.cost),
    csvEscape(r.currency),
    csvEscape(r.timestamp),
  ].join(','));

  return [CSV_HEADER, ...rows].join('\n');
}

/**
 * Pure handler: reads the store, builds CSV, sets headers, sends body.
 * Exported for unit testing without Express routing.
 */
export function handleClubSessionsExport(
  store: SessionHistoryStore,
  _req: Request,
  res: Response,
): void {
  const records = store.getAll();
  const csv = buildSessionCsv(records);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="rallyos-sessions.csv"',
  );
  res.send(csv);
}

/**
 * Factory: builds an Express Router with the CSV export endpoint wrapped
 * in the provided auth middleware. Mirrors `createExportRouter` in
 * `./export.ts` (used by the tournament matches CSV export).
 *
 * @param store  SessionHistoryStore for reading persisted records.
 * @param authMiddleware  Express middleware for club-admin auth validation
 *                        (produced by `createClubAuthMiddleware`).
 */
export function createClubSessionsExportRouter(
  store: SessionHistoryStore,
  authMiddleware: (req: Request, res: Response, next: () => void) => void,
): Router {
  const router = Router();

  router.get('/', authMiddleware, (_req: Request, res: Response) => {
    handleClubSessionsExport(store, _req, res);
  });

  return router;
}