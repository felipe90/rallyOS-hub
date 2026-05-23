import { useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X } from 'lucide-react';

export interface QrExpandModalProps {
  joinUrl: string;
  onClose: () => void;
}

export function QrExpandModal({ joinUrl, onClose }: QrExpandModalProps) {
  // Escape key dismiss
  useEffect(() => {
    if (!joinUrl) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [joinUrl, onClose]);

  // Don't render if no URL
  if (!joinUrl) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div className="relative bg-surface rounded-lg shadow-xl p-6 flex flex-col items-center gap-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-2 rounded-full hover:bg-surface-low transition-colors"
          aria-label="Close QR code"
        >
          <X size={20} />
        </button>

        {/* Large QR code — 250px for scanability */}
        <div className="w-[250px] h-[250px]">
          <QRCodeSVG
            value={joinUrl}
            size={250}
            level="M"
            includeMargin={true}
          />
        </div>

        <p className="text-sm text-text-muted">Scan to join the match</p>
      </div>
    </div>
  );
}
