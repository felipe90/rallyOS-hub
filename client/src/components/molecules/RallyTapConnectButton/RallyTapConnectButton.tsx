/**
 * RallyTapConnectButton — UI button + status badge for RallyTap BLE bridge.
 *
 * Renders a connect/disconnect toggle with status badge.
 * States: idle, scanning, connected, reconnecting, error.
 *
 * @module components/molecules/RallyTapConnectButton
 */

import type { BleState } from '@/services/ble/bridge'
import { useI18n } from '@/i18n'

// ── Props ──────────────────────────────────────────────────────

export interface RallyTapConnectButtonProps {
  /** Current BLE connection status. */
  bleStatus: BleState
  /** Display name of the connected device. */
  deviceName: string | null
  /** Human-readable error message. */
  errorMessage: string | null
  /** Called when the user clicks "Connect RallyTap". */
  onConnect: () => void
  /** Called when the user clicks "Disconnect". */
  onDisconnect: () => void
}

// ── Helpers ────────────────────────────────────────────────────

interface StatusBadgeConfig {
  label: string
  variant:
    | 'idle'
    | 'scanning'
    | 'connected'
    | 'reconnecting'
    | 'error'
}

function getStatusConfig(
  bleStatus: BleState,
  t: (key: string) => string,
): StatusBadgeConfig {
  switch (bleStatus) {
    case 'idle':
      return { label: t('rallyTapStatusIdle'), variant: 'idle' }
    case 'scanning':
      return { label: t('rallyTapStatusScanning'), variant: 'scanning' }
    case 'connecting':
      return { label: t('rallyTapStatusConnecting'), variant: 'scanning' }
    case 'connected':
      return { label: t('rallyTapStatusConnected'), variant: 'connected' }
    case 'reconnecting':
      return { label: t('rallyTapStatusReconnecting'), variant: 'reconnecting' }
    case 'error':
      return { label: t('rallyTapStatusError'), variant: 'error' }
  }
}

// ── Variant Styles ─────────────────────────────────────────────

const variantStyles: Record<StatusBadgeConfig['variant'], string> = {
  idle: 'bg-gray-100 text-gray-600 border-gray-300',
  scanning: 'bg-blue-50 text-blue-700 border-blue-300 animate-pulse',
  connected: 'bg-green-50 text-green-700 border-green-300',
  reconnecting: 'bg-yellow-50 text-yellow-700 border-yellow-300 animate-pulse',
  error: 'bg-red-50 text-red-700 border-red-300',
}

const buttonStyles: Record<string, string> = {
  idle:
    'bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors',
  scanning:
    'bg-blue-400 text-white font-medium py-2 px-4 rounded-lg cursor-not-allowed',
  connecting:
    'bg-blue-400 text-white font-medium py-2 px-4 rounded-lg cursor-not-allowed',
  connected:
    'bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors',
  reconnecting:
    'bg-gray-400 text-white font-medium py-2 px-4 rounded-lg cursor-not-allowed',
  error:
    'bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors',
}

// ── Component ──────────────────────────────────────────────────

export function RallyTapConnectButton({
  bleStatus,
  deviceName,
  errorMessage,
  onConnect,
  onDisconnect,
}: RallyTapConnectButtonProps) {
  const { i18nText: t } = useI18n()
  const config = getStatusConfig(bleStatus, t)
  const isBusy =
    bleStatus === 'scanning' ||
    bleStatus === 'connecting' ||
    bleStatus === 'reconnecting'

  const isConnected = bleStatus === 'connected'

  return (
    <div className="flex flex-col gap-2">
      {/* Status badge */}
      <div
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${variantStyles[config.variant]}`}
      >
        <span
          className={`inline-block w-2 h-2 rounded-full ${
            bleStatus === 'connected'
              ? 'bg-green-500'
              : bleStatus === 'error'
                ? 'bg-red-500'
                : bleStatus === 'idle'
                  ? 'bg-gray-400'
                  : 'bg-blue-500'
          }`}
        />
        <span>{config.label}</span>
        {deviceName && isConnected && (
          <span className="text-xs opacity-75 ml-1">({deviceName})</span>
        )}
      </div>

      {/* Action button */}
      <button
        type="button"
        disabled={isBusy}
        onClick={isConnected ? onDisconnect : onConnect}
        className={buttonStyles[bleStatus]}
      >
        {isBusy
          ? bleStatus === 'scanning'
            ? t('rallyTapStatusScanning')
            : bleStatus === 'connecting'
              ? t('rallyTapStatusConnecting')
              : t('rallyTapStatusReconnecting')
          : isConnected
            ? t('rallyTapButtonDisconnect')
            : t('rallyTapButtonConnect')}
      </button>

      {/* Error message */}
      {bleStatus === 'error' && errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}
    </div>
  )
}
