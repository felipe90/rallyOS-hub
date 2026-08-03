import { MatchExporter, PersistedCourt } from './types';

// Characters that, when leading a spreadsheet cell, trigger formula
// evaluation in Excel/LibreOffice/Sheets. Prefixing with a single quote
// forces text rendering. Mirrors the escaping contract documented in
// routes/clubSessionsExport.ts.
const DANGEROUS_LEADING_CHARS = new Set(['=', '+', '-', '@']);

/**
 * CSV-escape a single cell value (CSV injection / formula injection guard).
 *
 * - A leading `=`, `+`, `-`, or `@` is prefixed with a single quote `'`
 *   (inside the wrapping quotes) so spreadsheet software renders the cell
 *   as text instead of evaluating it as a formula.
 * - Cells containing a double quote, CR, or LF are wrapped in double quotes
 *   (embedded quotes doubled per RFC-4180) so the value stays one cell.
 * - Safe plain values are returned as-is (no unnecessary quoting), keeping
 *   the export readable.
 *
 * Pure — no I/O.
 */
function csvEscape(value: string | number): string {
  const str = typeof value === 'number' ? String(value) : (value ?? '');

  if (str.length > 0 && DANGEROUS_LEADING_CHARS.has(str[0])) {
    return `"'${str.replace(/"/g, '""')}"`;
  }

  if (/["\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

/**
 * CSV exporter for finished tournament matches.
 *
 * Implements the MatchExporter interface. Pure function: takes an array
 * of PersistedCourt, filters to FINISHED, and returns a CSV string.
 *
 * CSV columns: table_number, table_name, player_a, player_b,
 *              sets_won_a, sets_won_b, set_scores, winner
 *
 * set_scores format: "11-9/8-11/11-5/11-7" (single column,
 * "/" separator between sets, "-" within each set).
 */
export class CsvExporter implements MatchExporter {
  private static readonly HEADER =
    'table_number,table_name,player_a,player_b,sets_won_a,sets_won_b,set_scores,winner';

  export(tables: PersistedCourt[]): string {
    const finished = tables
      .filter((t) => t.status === 'FINISHED')
      .sort((a, b) => a.number - b.number);

    const rows = finished.map((t) => this.formatRow(t));

    return [CsvExporter.HEADER, ...rows, ''].join('\n');
  }

  /**
   * Format a single FINISHED table as a CSV row.
   */
  private formatRow(table: PersistedCourt): string {
    const { setHistory } = table.matchState;

    // Count sets won by each player from set history
    let setsWonA = 0;
    let setsWonB = 0;

    const setScoreParts: string[] = [];

    for (const set of setHistory) {
      setScoreParts.push(`${set.a}-${set.b}`);

      if (set.a > set.b) {
        setsWonA++;
      } else if (set.b > set.a) {
        setsWonB++;
      }
    }

    const setScores = setScoreParts.join('/');
    const winner = setsWonA > setsWonB
      ? table.playerNames.a
      : setsWonB > setsWonA
        ? table.playerNames.b
        : '';

    const columns = [
      csvEscape(table.number),
      csvEscape(table.name),
      csvEscape(table.playerNames.a),
      csvEscape(table.playerNames.b),
      csvEscape(setsWonA),
      csvEscape(setsWonB),
      csvEscape(setScores),
      csvEscape(winner),
    ];

    return columns.join(',');
  }
}
