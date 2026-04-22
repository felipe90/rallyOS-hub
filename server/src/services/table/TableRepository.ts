/**
 * TableRepository - Table CRUD operations
 *
 * Responsibility: Store and retrieve tables.
 */

import { Table } from '../../types';

export class TableRepository {
  private tables: Map<string, Table> = new Map();

  create(table: Table): Table {
    this.tables.set(table.id, table);
    return table;
  }

  get(tableId: string): Table | undefined {
    return this.tables.get(tableId);
  }

  delete(tableId: string): boolean {
    return this.tables.delete(tableId);
  }

  getAll(): Table[] {
    return Array.from(this.tables.values());
  }

  getNextTableNumber(): number {
    const usedNumbers = new Set<number>();
    for (const table of this.tables.values()) {
      usedNumbers.add(table.number);
    }

    let nextNumber = 1;
    while (usedNumbers.has(nextNumber)) {
      nextNumber++;
    }
    return nextNumber;
  }

  clear(): void {
    this.tables.clear();
  }
}
