/**
 * BLEBridge — Web Bluetooth bridge for RallyTap physical score button.
 *
 * Manages BLE connection lifecycle, button-press notification forwarding,
 * and score write-back from hub MATCH_UPDATE events.
 *
 * Pure service layer — no JSX, no socket dependency.
 * The useRallyTapBridge hook wires this to Socket.IO.
 *
 * @module services/ble/bridge
 */

// ── Constants ──────────────────────────────────────────────────

export const SERVICE_UUID = 'f000a001-0451-4000-b000-000000000000'
export const BUTTON_PRESS_UUID = 'f000a003-0451-4000-b000-000000000000'
export const SCORE_DISPLAY_UUID = 'f000a004-0451-4000-b000-000000000000'
export const DEVICE_NAME_UUID = 'f000a002-0451-4000-b000-000000000000'

const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_INTERVAL_MS = 2000
const SCAN_TIMEOUT_MS = 30000

// ── Public Types ───────────────────────────────────────────────

/** Possible BLE connection states exposed to the UI layer. */
export type BleState = 'idle' | 'scanning' | 'connecting' | 'connected' | 'reconnecting' | 'error'

/** Payload sent by the hub's MATCH_UPDATE event. */
export interface ScorePayload {
  a?: number
  b?: number
  set_a?: number
  set_b?: number
  status?: string
  msg?: string
  [key: string]: unknown
}

/** Snapshot returned by getState(). */
export interface BridgeState {
  readonly connected: boolean
  readonly deviceName: string | null
}

// ── Private Callback Types ─────────────────────────────────────

type ButtonPressCallback = (player: 'A' | 'B') => void
type ConnectionChangeCallback = (state: BleState) => void
type ReconnectAttemptCallback = (attempt: number, max: number) => void
type ErrorCallback = (message: string) => void

// ── BLEBridge ──────────────────────────────────────────────────

/**
 * BLEBridge connects to a RallyTap device via Web Bluetooth,
 * notifies registered callbacks on button press,
 * and writes MATCH_UPDATE scores back to the device display.
 *
 * The companion hook (useRallyTapBridge) wires callbacks to Socket.IO.
 */
export class BLEBridge {
  private courtId: string

  // BLE state
  private device: BluetoothDevice | null = null
  private server: BluetoothRemoteGATTServer | null = null
  private service: BluetoothRemoteGATTService | null = null
  private buttonPressChar: BluetoothRemoteGATTCharacteristic | null = null
  private scoreDisplayChar: BluetoothRemoteGATTCharacteristic | null = null
  private _deviceName: string | null = null
  private _connected = false

  // Callback registries
  private _buttonPressCbs: ButtonPressCallback[] = []
  private _connectionChangeCbs: ConnectionChangeCallback[] = []
  private _reconnectAttemptCbs: ReconnectAttemptCallback[] = []
  private _errorCbs: ErrorCallback[] = []

  // Reconnect control
  private _reconnectAbort = false
  private _reconnectTimer: ReturnType<typeof setTimeout> | null = null

  // Bound handlers (arrow class properties for stable references)
  private handleDisconnect = (): void => {
    if (this._reconnectAbort) return
    this._connected = false
    this.emitState('reconnecting')
    this.attemptReconnect()
  }

  private handleNotification = (event: Event): void => {
    const target = event.target as BluetoothRemoteGATTCharacteristic
    const value = target.value
    if (!value || value.byteLength === 0) return

    const byte = value.getUint8(0)
    const player: 'A' | 'B' = byte === 0x02 ? 'B' : 'A'

    // Notify registered callbacks — hook wires these to socket events
    for (const cb of this._buttonPressCbs) {
      cb(player)
    }
  }

  // ── Constructor ────────────────────────────────────────────────

  constructor(courtId: string) {
    this.courtId = courtId
  }

  // ── Public API ─────────────────────────────────────────────────

  /**
   * Open a Web Bluetooth scan, connect to the selected RallyTap device,
   * subscribe to button-press notifications, and start forwarding.
   */
  async connect(): Promise<void> {
    if (!navigator.bluetooth) {
      this.emitError('Browser not supported')
      return
    }

    this._reconnectAbort = false
    this.emitState('scanning')

    let device: BluetoothDevice

    try {
      device = await Promise.race([
        navigator.bluetooth.requestDevice({
          filters: [{ services: [SERVICE_UUID] }],
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('SCAN_TIMEOUT')), SCAN_TIMEOUT_MS),
        ),
      ])
    } catch (err: unknown) {
      const message =
        err instanceof Error && err.message === 'SCAN_TIMEOUT'
          ? 'Timed out'
          : 'Cancelled'
      this.emitError(message)
      return
    }

    this.device = device
    this.emitState('connecting')

    try {
      const server = await device.gatt!.connect()
      this.server = server

      const service = await server.getPrimaryService(SERVICE_UUID)
      this.service = service

      // Read device name characteristic
      await this.readDeviceName(service, device)

      // Get button-press and score-display characteristics
      this.buttonPressChar = await service.getCharacteristic(BUTTON_PRESS_UUID)
      this.scoreDisplayChar = await service.getCharacteristic(SCORE_DISPLAY_UUID)

      // Subscribe to button-press notifications
      await this.buttonPressChar.startNotifications()
      this.buttonPressChar.addEventListener(
        'characteristicvaluechanged',
        this.handleNotification,
      )

      // Attach disconnect handler for auto-reconnect
      device.addEventListener('gattserverdisconnected', this.handleDisconnect)

      this._connected = true
      this.emitState('connected')
    } catch {
      this.emitError('Connection failed')
    }
  }

  /**
   * Gracefully disconnect from the RallyTap device.
   * Cancels any pending reconnect loop.
   */
  disconnect(): void {
    // Prevent auto-reconnect from firing
    this._reconnectAbort = true

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = null
    }

    // Clean up notification listener
    if (this.buttonPressChar) {
      this.buttonPressChar.removeEventListener(
        'characteristicvaluechanged',
        this.handleNotification,
      )
      this.buttonPressChar.stopNotifications().catch(() => {})
    }

    // Clean up disconnect handler
    if (this.device) {
      this.device.removeEventListener(
        'gattserverdisconnected',
        this.handleDisconnect,
      )
    }

    // Disconnect GATT
    if (this.server?.connected) {
      try {
        this.server.disconnect()
      } catch {
        // Ignore disconnect errors
      }
    }

    this.resetState()
    this.emitState('idle')
  }

  /**
   * Write a score/status payload to the device's score_display characteristic.
   * Catches and logs errors — never throws.
   *
   * Per spec R7: status/msg are stripped when status is "ok" to reduce payload size.
   */
  async writeScore(score: ScorePayload): Promise<void> {
    if (!this.scoreDisplayChar) return

    try {
      // Strip status/msg when ok per R7 confirmation scenario
      const payload: Record<string, unknown> = { ...score }
      if (payload.status === 'ok') {
        delete payload.status
        delete payload.msg
      }

      const json = JSON.stringify(payload)
      const encoder = new TextEncoder()
      await this.scoreDisplayChar.writeValue(encoder.encode(json))
    } catch (err) {
      console.error('[BLEBridge] writeScore error:', err)
    }
  }

  /** Register a callback fired when the button is pressed. */
  onButtonPress(cb: ButtonPressCallback): void {
    this._buttonPressCbs.push(cb)
  }

  /** Register a callback fired when the BLE connection state changes. */
  onConnectionChange(cb: ConnectionChangeCallback): void {
    this._connectionChangeCbs.push(cb)
  }

  /** Register a callback fired on each reconnect attempt (1-indexed). */
  onReconnectAttempt(cb: ReconnectAttemptCallback): void {
    this._reconnectAttemptCbs.push(cb)
  }

  /** Register a callback fired on a non-recoverable error. */
  onError(cb: ErrorCallback): void {
    this._errorCbs.push(cb)
  }

  /** Return a snapshot of the current connection state. */
  getState(): BridgeState {
    return {
      connected: this._connected,
      deviceName: this._deviceName,
    }
  }

  /** Return the court ID assigned to this bridge instance. */
  getCourtId(): string {
    return this.courtId
  }

  // ── Reconnect Logic ───────────────────────────────────────────

  /**
   * Attempt to reconnect to the previously paired device.
   * Retries at 2s intervals up to MAX_RECONNECT_ATTEMPTS (5).
   * On exhaustion, emits an error and returns to idle state.
   */
  private async attemptReconnect(): Promise<void> {
    if (!this.device?.gatt) {
      this.emitError('Connection lost')
      return
    }

    for (let attempt = 1; attempt <= MAX_RECONNECT_ATTEMPTS; attempt++) {
      if (this._reconnectAbort) return

      // Notify listeners of reconnect attempt
      for (const cb of this._reconnectAttemptCbs) {
        cb(attempt, MAX_RECONNECT_ATTEMPTS)
      }

      // Wait for the reconnect interval
      await this.delay(RECONNECT_INTERVAL_MS)
      if (this._reconnectAbort) return

      try {
        const server = await this.device.gatt.connect()
        this.server = server
        this.service = await server.getPrimaryService(SERVICE_UUID)

        // Re-acquire characteristics
        this.buttonPressChar =
          await this.service.getCharacteristic(BUTTON_PRESS_UUID)
        this.scoreDisplayChar =
          await this.service.getCharacteristic(SCORE_DISPLAY_UUID)

        // Re-subscribe to notifications
        await this.buttonPressChar.startNotifications()
        this.buttonPressChar.addEventListener(
          'characteristicvaluechanged',
          this.handleNotification,
        )

        this._connected = true
        this.emitState('connected')
        return // success
      } catch {
        // Attempt failed — continue loop
      }
    }

    // All attempts exhausted
    if (!this._reconnectAbort) {
      this.emitError('Connection lost')
    }
  }

  // ── Private Helpers ───────────────────────────────────────────

  private async readDeviceName(
    service: BluetoothRemoteGATTService,
    device: BluetoothDevice,
  ): Promise<void> {
    try {
      const nameChar = await service.getCharacteristic(DEVICE_NAME_UUID)
      const nameValue = await nameChar.readValue()
      this._deviceName = new TextDecoder().decode(nameValue).trim()
    } catch {
      // Fall back to the advertised device name
      this._deviceName = device.name || null
    }
  }

  private emitState(state: BleState): void {
    for (const cb of this._connectionChangeCbs) {
      cb(state)
    }
  }

  private emitError(message: string): void {
    for (const cb of this._errorCbs) {
      cb(message)
    }
    this.emitState('error')
  }

  private resetState(): void {
    this._connected = false
    this.device = null
    this.server = null
    this.service = null
    this.buttonPressChar = null
    this.scoreDisplayChar = null
    this._deviceName = null
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => {
      this._reconnectTimer = setTimeout(resolve, ms)
    })
  }
}
