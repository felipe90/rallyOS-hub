/**
 * QRService - QR data generation
 *
 * Responsibility: Generate QR data for table joining.
 */

import { Table, QRData, HubConfig } from '../../types';
import { encryptPin } from '../../utils/pinEncryption';

export class QRService {
  private hubConfig: HubConfig;

  constructor(hubConfig: HubConfig) {
    this.hubConfig = hubConfig;
  }

  generateQRData(table: Table): QRData | null {
    if (!table) return null;

    const encryptedPin = encryptPin(table.pin, table.id);

    return {
      hubSsid: this.hubConfig.ssid,
      hubIp: this.hubConfig.ip,
      hubPort: this.hubConfig.port,
      tableId: table.id,
      tableName: table.name,
      pin: table.pin,
      encryptedPin,
      url: `rallyhub://join/${table.id}?ePin=${encodeURIComponent(encryptedPin)}`
    };
  }
}
