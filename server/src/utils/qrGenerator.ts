import QRCode from 'qrcode';
import { QRData } from '../types';

export async function generateQRDataUrl(data: QRData): Promise<string> {
  try {
    const dataString = JSON.stringify(data);
    const dataUrl = await QRCode.toDataURL(dataString, {
      width: 300,
      margin: 2,
      color: {
        dark: '#14B8A6',
        light: '#FFFFFF'
      },
      errorCorrectionLevel: 'M'
    });
    return dataUrl;
  } catch (error) {
    console.error('[QRGenerator] Error generating QR:', error);
    throw error;
  }
}

export function parseQRCode(qrString: string): QRData | null {
  try {
    const data = JSON.parse(qrString);
    if (data.tableId && data.pin) {
      return data as QRData;
    }
    return null;
  } catch {
    return null;
  }
}
