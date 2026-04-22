import { QRCodeSVG } from 'qrcode.react';

/* QRCodeImage - Displays QR code from a pre-built URL */
export interface QRCodeImageProps {
  joinUrl: string;
  size?: number; // Ignored - now uses 100% width/height
}

export function QRCodeImage({ joinUrl }: QRCodeImageProps) {
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
