import { QRCodeSVG } from 'qrcode.react';

/* QRCodeImage - Generates QR code for table join */
export interface QRCodeImageProps {
  tableId: string;
  pin: string;
  size?: number; // Ignored - now uses 100% width/height
}

// XOR encryption with daily key (matches ScoreboardPage decryption)
// Uses tableId + daily salt to generate key
const generateKey = (tableId: string): string => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dailySalt = today.getTime().toString()
  let hash = 0
  const combined = tableId + dailySalt
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const encryptPin = (pin: string, tableId: string): string => {
  const key = generateKey(tableId)
  let encrypted = ''
  
  for (let i = 0; i < pin.length; i++) {
    const charCode = pin.charCodeAt(i)
    const keyChar = key[i % key.length]
    const encryptedByte = charCode ^ keyChar.charCodeAt(0)
    encrypted += encryptedByte.toString(16).padStart(2, '0')
  }
  
  return encrypted
}

export function QRCodeImage({ tableId, pin }: QRCodeImageProps) {
  // Encrypt PIN for secure URL (same logic as server)
  const encryptedPin = encryptPin(pin, tableId)
  
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