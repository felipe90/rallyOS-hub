/**
 * BLEBridge unit tests — mocked Web Bluetooth API.
 *
 * Covers button-press notification forwarding, reconnect logic,
 * writeScore payload shaping, disconnect cleanup, and browser
 * support detection.
 *
 * @module services/ble/bridge.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  BLEBridge,
  SERVICE_UUID,
  BUTTON_PRESS_UUID,
  SCORE_DISPLAY_UUID,
  DEVICE_NAME_UUID,
} from './bridge'

const COURT_ID = 'test-court-1'

// ── Mock Factory ────────────────────────────────────────────────

/**
 * Build a complete mock Web Bluetooth stack with stored-event tracking
 * so tests can trigger disconnect / notifications programmatically.
 */
function createMockBluetooth() {
  // ── Individual characteristics ────────────────────────────────

  const deviceNameChar = {
    readValue: vi
      .fn()
      .mockResolvedValue(
        new DataView(new Uint8Array([82, 97, 108, 108, 121, 84, 97, 112]).buffer),
      ),
    writeValue: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    startNotifications: vi.fn().mockResolvedValue(undefined),
    stopNotifications: vi.fn().mockResolvedValue(undefined),
  }

  const buttonPressChar = {
    startNotifications: vi.fn().mockResolvedValue(undefined),
    stopNotifications: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    writeValue: vi.fn().mockResolvedValue(undefined),
    readValue: vi.fn(),
    value: undefined as DataView | undefined,
  }

  const scoreDisplayChar = {
    startNotifications: vi.fn().mockResolvedValue(undefined),
    stopNotifications: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    writeValue: vi.fn().mockResolvedValue(undefined),
    readValue: vi.fn(),
  }

  // ── GATT service ──────────────────────────────────────────────

  const service = {
    getCharacteristic: vi.fn((uuid: string) => {
      if (uuid === BUTTON_PRESS_UUID) return Promise.resolve(buttonPressChar)
      if (uuid === SCORE_DISPLAY_UUID) return Promise.resolve(scoreDisplayChar)
      if (uuid === DEVICE_NAME_UUID) return Promise.resolve(deviceNameChar)
      return Promise.reject(new Error('Unknown UUID'))
    }),
  }

  // ── GATT server ───────────────────────────────────────────────

  const server = {
    connected: true,
    device: null as any,
    connect: vi.fn(),
    disconnect: vi.fn(),
    getPrimaryService: vi.fn().mockResolvedValue(service),
  }
  server.connect.mockResolvedValue(server)

  const disconnectListeners: EventListener[] = []

  // ── Bluetooth device ──────────────────────────────────────────

  const device: any = {
    name: 'RallyTap-001',
    gatt: server,
    addEventListener: vi.fn(
      (event: string, listener: EventListener) => {
        if (event === 'gattserverdisconnected') {
          disconnectListeners.push(listener)
        }
      },
    ),
    removeEventListener: vi.fn(),
  }
  server.device = device

  // ── Notification tracking ─────────────────────────────────────

  const notificationListeners: Array<{
    event: string
    listener: EventListener
  }> = []

  buttonPressChar.addEventListener = vi.fn(
    (event: string, listener: EventListener) => {
      notificationListeners.push({ event, listener })
    },
  )

  // ── Trigger helpers ───────────────────────────────────────────

  return {
    bluetooth: { requestDevice: vi.fn().mockResolvedValue(device) },
    device,
    server,
    service,
    buttonPressChar,
    scoreDisplayChar,
    deviceNameChar,

    /** Simulate a GATT disconnect event on the device. */
    triggerDisconnect() {
      for (const listener of disconnectListeners) {
        listener(new Event('gattserverdisconnected'))
      }
    },

    /** Simulate a characteristic-value-changed notification with a given byte. */
    triggerNotification(byte: number) {
      const entry = notificationListeners.find(
        l => l.event === 'characteristicvaluechanged',
      )
      if (!entry) return
      const dataView = new DataView(new Uint8Array([byte]).buffer)
      entry.listener({
        target: { value: dataView },
      } as unknown as Event)
    },
  }
}

// ── Tests ───────────────────────────────────────────────────────

describe('BLEBridge', () => {
  let mockBT: ReturnType<typeof createMockBluetooth>

  beforeEach(() => {
    mockBT = createMockBluetooth()
    vi.stubGlobal('navigator', { bluetooth: mockBT.bluetooth })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  // ── 1. Button press A ─────────────────────────────────────────

  it('should fire callback with A on button press notification byte 0x01', async () => {
    const bridge = new BLEBridge(COURT_ID)
    const onPress = vi.fn()
    bridge.onButtonPress(onPress)

    await bridge.connect()

    mockBT.triggerNotification(0x01)

    expect(onPress).toHaveBeenCalledWith('A')
  })

  // ── 2. Button press B ─────────────────────────────────────────

  it('should fire callback with B on button press notification byte 0x02', async () => {
    const bridge = new BLEBridge(COURT_ID)
    const onPress = vi.fn()
    bridge.onButtonPress(onPress)

    await bridge.connect()

    mockBT.triggerNotification(0x02)

    expect(onPress).toHaveBeenCalledWith('B')
  })

  // ── 3. Reconnect loop exhaust ─────────────────────────────────

  it('should emit Connection lost error after exhausting 5 reconnect attempts', async () => {
    vi.useFakeTimers()

    const bridge = new BLEBridge(COURT_ID)
    const onError = vi.fn()
    const onReconnect = vi.fn()
    bridge.onError(onError)
    bridge.onReconnectAttempt(onReconnect)

    await bridge.connect()

    // Make the GATT connect reject for all reconnection attempts
    mockBT.server.connect.mockRejectedValue(new Error('Disconnected'))

    // Trigger disconnect
    mockBT.triggerDisconnect()

    // Advance timers through 5 × 2s reconnect intervals
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(2000)
    }

    expect(onReconnect).toHaveBeenCalledTimes(5)
    expect(onError).toHaveBeenCalledWith('Connection lost')
  })

  // ── 4. writeScore strips status/msg when ok ───────────────────

  it('should strip status and msg from writeScore payload when status is ok', async () => {
    const bridge = new BLEBridge(COURT_ID)
    await bridge.connect()

    await bridge.writeScore({
      a: 5,
      b: 3,
      status: 'ok',
      msg: 'all good',
    })

    const written = mockBT.scoreDisplayChar.writeValue.mock.calls[0]?.[0]
    const decoder = new TextDecoder()
    const json = decoder.decode(written)
    expect(JSON.parse(json)).toEqual({ a: 5, b: 3 })
  })

  // ── 5. writeScore keeps status when not ok ────────────────────

  it('should keep status and msg in writeScore payload when status is not ok', async () => {
    const bridge = new BLEBridge(COURT_ID)
    await bridge.connect()

    await bridge.writeScore({
      a: 5,
      b: 3,
      status: 'error',
      msg: 'fail',
    })

    const written = mockBT.scoreDisplayChar.writeValue.mock.calls[0]?.[0]
    const decoder = new TextDecoder()
    const json = decoder.decode(written)
    expect(JSON.parse(json)).toEqual({
      a: 5,
      b: 3,
      status: 'error',
      msg: 'fail',
    })
  })

  // ── 6. Disconnect cleanup ─────────────────────────────────────

  it('should clean up listeners and reset state on disconnect', async () => {
    const bridge = new BLEBridge(COURT_ID)
    await bridge.connect()

    bridge.disconnect()

    // Device-level disconnect handler removed
    expect(mockBT.device.removeEventListener).toHaveBeenCalledWith(
      'gattserverdisconnected',
      expect.any(Function),
    )

    // Notification listener removed
    expect(mockBT.buttonPressChar.removeEventListener).toHaveBeenCalledWith(
      'characteristicvaluechanged',
      expect.any(Function),
    )

    // Internal state reset
    expect(bridge.getState()).toEqual({
      connected: false,
      deviceName: null,
    })
  })

  // ── 7. Browser not supported ──────────────────────────────────

  it('should emit Browser not supported error when navigator.bluetooth is missing', async () => {
    vi.stubGlobal('navigator', {})

    const bridge = new BLEBridge(COURT_ID)
    const onError = vi.fn()
    bridge.onError(onError)

    await bridge.connect()

    expect(onError).toHaveBeenCalledWith('Browser not supported')
  })
})
