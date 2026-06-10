/**
 * CourtRepository - Table CRUD operations
 *
 * Responsibility: Store and retrieve tables.
 */

import { Court } from '../../domain/types';

export class CourtRepository {
  private tables: Map<string, Court> = new Map();

  create(table: Court): Court {
    this.tables.set(table.id, table);
    return table;
  }

  get(tableId: string): Court | undefined {
    return this.tables.get(tableId);
  }

  delete(tableId: string): boolean {
    return this.tables.delete(tableId);
  }

  getAll(): Court[] {
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
/** @deprecated Use CourtRepository instead */
export type TableRepository = CourtRepository;
/** @deprecated Use CourtRepository instead */
export const TableRepository = CourtRepository;
