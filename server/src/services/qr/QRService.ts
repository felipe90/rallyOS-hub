/**
 * QRService - QR data generation
 *
 * Responsibility: Generate QR data for table joining.
 */

import type { RuntimeCourt, QRData, HubConfig } from '../../domain/types';
import { encryptPin } from '../../utils/pinEncryption';
import type { IQRService } from '../../domain/ports';

export class QRService implements IQRService {
  private hubConfig: HubConfig;

  constructor(hubConfig: HubConfig) {
    this.hubConfig = hubConfig;
  }

  generateQRData(court: RuntimeCourt): QRData | null {
    if (!court) return null;

    const encryptedPin = encryptPin(court.pin, court.record.courtId);

    return {
      hubSsid: this.hubConfig.ssid,
      hubIp: this.hubConfig.ip,
      hubPort: this.hubConfig.port,
      courtId: court.record.courtId,
      courtName: court.name,
      encryptedPin,
      url: `rallyhub://join/${court.record.courtId}?ePin=${encodeURIComponent(encryptedPin)}`
    };
  }
}
