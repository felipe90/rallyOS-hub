/**
 * QRService - QR data generation
 *
 * Responsibility: Generate QR data for table joining.
 */

import { Court, QRData, HubConfig } from '../../domain/types';
import { encryptPin } from '../../utils/pinEncryption';

export class QRService {
  private hubConfig: HubConfig;

  constructor(hubConfig: HubConfig) {
    this.hubConfig = hubConfig;
  }

  generateQRData(court: Court): QRData | null {
    if (!court) return null;

    const encryptedPin = encryptPin(court.pin, court.id);

    return {
      hubSsid: this.hubConfig.ssid,
      hubIp: this.hubConfig.ip,
      hubPort: this.hubConfig.port,
      courtId: court.id,
      courtName: court.name,
      pin: court.pin,
      encryptedPin,
      url: `rallyhub://join/${court.id}?ePin=${encodeURIComponent(encryptedPin)}`
    };
  }
}
