/**
 * IQRService — QR data generation interface.
 *
 * Domain-level contract for generating QR code data that encodes
 * court connection information. Implementations use HubConfig
 * (received at construction) to build QRData for joining a court.
 *
 * Following the SportRules pattern in domain/sports/types.ts:
 * pure interface, one file per concern.
 */

import type { Court } from '../types';
import type { QRData } from '../types';

export interface IQRService {
  /**
   * Generate QR data for the given court.
   * Returns null if the court is invalid or data cannot be generated.
   */
  generateQRData(court: Court): QRData | null;
}
