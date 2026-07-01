/**
 * useRallyTapBridge — React hook that wires BLEBridge ↔ Socket.IO.
 *
 * Creates a BLEBridge instance, forwards button presses to the hub
 * via RECORD_POINT, and writes MATCH_UPDATE scores to the device display.
 *
 * @module hooks/useRallyTapBridge
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import type { Socket } from 'socket.io-client'
import { SocketEvents } from '@shared/events'
import { BLEBridge } from '@/services/ble/bridge'
import type { BleState, ScorePayload } from '@/services/ble/bridge'

// ── Public Types ───────────────────────────────────────────────

export interface RallyTapState {
  /** Current BLE connection status. */
  bleStatus: BleState
  /** Display name of the connected RallyTap device. */
  deviceName: string | null
  /** Human-readable error message (set when bleStatus is 'error'). */
  errorMessage: string | null
  /** Latest score received from the hub. */
  score: { a: number; b: number } | null
}

export interface UseRallyTapBridgeReturn extends RallyTapState {
  /** Initiate BLE scanning and connect to a RallyTap device. */
  connect: () => Promise<void>
  /** Disconnect from the current device. */
  disconnect: () => void
}

// ── Hook ───────────────────────────────────────────────────────

/**
 * Manages a BLEBridge lifecycle and wires it to the given Socket.IO instance.
 *
 * @param socket  Socket.IO client instance (or null if not connected).
 * @param courtId Court/table ID for RECORD_POINT events.
 */
export function useRallyTapBridge(
  socket: Socket | null,
  courtId: string,
): UseRallyTapBridgeReturn {
  const [state, setState] = useState<RallyTapState>({
    bleStatus: 'idle',
    deviceName: null,
    errorMessage: null,
    score: null,
  })

  const bridgeRef = useRef<BLEBridge | null>(null)

  // ── Lifecycle: create/wire/teardown the bridge ────────────────

  useEffect(() => {
    // Clean up previous bridge instance
    bridgeRef.current?.disconnect()

    const bridge = new BLEBridge(courtId)
    bridgeRef.current = bridge

    // Wire button presses from BLE → hub via socket
    bridge.onButtonPress((player: 'A' | 'B') => {
      if (socket?.connected) {
        socket.emit(SocketEvents.CLIENT.RECORD_POINT, { courtId, player })
      }
    })

    // Wire connection-state changes to React state
    bridge.onConnectionChange((bleStatus: BleState) => {
      setState(prev => ({
        ...prev,
        bleStatus,
        deviceName:
          bleStatus === 'connected'
            ? bridge.getState().deviceName ?? prev.deviceName
            : bleStatus === 'idle'
              ? null
              : prev.deviceName,
        errorMessage:
          bleStatus === 'error' ? prev.errorMessage : null,
      }))
    })

    // Wire errors
    bridge.onError((message: string) => {
      setState(prev => ({ ...prev, errorMessage: message }))
    })

    // Wire MATCH_UPDATE from hub → write to device
    const handleMatchUpdate = (payload: ScorePayload) => {
      setState(prev => ({
        ...prev,
        score: { a: payload?.a ?? 0, b: payload?.b ?? 0 },
      }))
      bridge.writeScore(payload)
    }

    // Wire ERROR from hub → store error message
    const handleHubError = (error: { message?: string; msg?: string }) => {
      const msg = error?.message || error?.msg || 'Error'
      setState(prev => ({ ...prev, errorMessage: msg }))
    }

    socket?.on(SocketEvents.SERVER.MATCH_UPDATE, handleMatchUpdate)
    socket?.on(SocketEvents.SERVER.ERROR, handleHubError)

    return () => {
      socket?.off(SocketEvents.SERVER.MATCH_UPDATE, handleMatchUpdate)
      socket?.off(SocketEvents.SERVER.ERROR, handleHubError)
      bridge.disconnect()
      bridgeRef.current = null
    }
  }, [socket, courtId])

  // ── Actions ───────────────────────────────────────────────────

  const connect = useCallback(async () => {
    await bridgeRef.current?.connect()
  }, [])

  const disconnect = useCallback(() => {
    bridgeRef.current?.disconnect()
    setState({
      bleStatus: 'idle',
      deviceName: null,
      errorMessage: null,
      score: null,
    })
  }, [])

  return {
    ...state,
    connect,
    disconnect,
  }
}
