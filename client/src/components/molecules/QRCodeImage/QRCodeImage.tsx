import { QRCodeSVG } from 'qrcode.react';
import { generateKey, encryptPin } from '@/shared/crypto/pinEncryption';

/* QRCodeImage - Generates QR code for table join */
export interface QRCodeImageProps {
  tableId: string;
  pin: string;
  size?: number; // Ignored - now uses 100% width/height
}

export function QRCodeImage({ tableId, pin }: QRCodeImageProps) {
  // Encrypt PIN for secure URL (same logic as server)
  const key = generateKey(tableId)
  const encryptedPin = encryptPin(pin, key)

  // Generate the URL that referee will use to join (goes to referee view for controls)
  const joinUrl = `${window.location.origin}/scoreboard/${tableId}/referee?ePin=${encryptedPin}`;
  
  return (
    <div className="w-full h-full flex items-center justify-center">
      <QRCodeSVG
        value={joinUrl}
        level="M"
        includeMargin={false}
        className="!rounded-none"
      />
    </div>
  );
}