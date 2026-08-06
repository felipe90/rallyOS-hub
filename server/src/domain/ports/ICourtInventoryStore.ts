/**
 * ICourtInventoryStore — domain port for the admin court catalog.
 *
 * The catalog (CourtRecord[]) is durable and admin-owned; every mutation is
 * written synchronously/immediately (PERS-3, no debounce) because admin
 * mutations are low-frequency. Implemented by CourtInventoryStore.
 */

import type { CourtRecord } from '../../../../shared/types';

export interface ICourtInventoryStore {
  /** Synchronous, immediate write of the full catalog (PERS-3). */
  save(courts: CourtRecord[]): void;

  /** Load the catalog. Returns null when the file is missing or invalid. */
  load(): CourtRecord[] | null;
}
