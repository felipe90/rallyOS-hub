import { MatchExporter, PersistedTable } from './types';

/**
 * CSV exporter for finished tournament matches.
 *
 * Implements the MatchExporter interface. Pure function: takes an array
 * of PersistedTable, filters to FINISHED, and returns a CSV string.
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

  export(tables: PersistedTable[]): string {
    const finished = tables
      .filter((t) => t.status === 'FINISHED')
      .sort((a, b) => a.number - b.number);

    const rows = finished.map((t) => this.formatRow(t));

    return [CsvExporter.HEADER, ...rows, ''].join('\n');
  }

  /**
   * Format a single FINISHED table as a CSV row.
   */
  private formatRow(table: PersistedTable): string {
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
      String(table.number),
      table.name,
      table.playerNames.a,
      table.playerNames.b,
      String(setsWonA),
      String(setsWonB),
      setScores,
      winner,
    ];

    return columns.join(',');
  }
}
