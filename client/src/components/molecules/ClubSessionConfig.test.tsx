/**
 * ClubSessionConfig — mode selector with name+phone inputs + client-side encryption.
 *
 * Spec: player-identity ("Name & Phone Input Before Mode", "Client-Side Phone Encryption")
 * Scenarios:
 *   - Happy path: player enters name, phone, selects mode → Comenzar enabled
 *   - Validation blocks play with empty fields
 *   - Without encryptionKey: phone emitted as raw text (graceful degradation)
 *   - With encryptionKey: phone encrypted via Web Crypto AES-256-GCM
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { ClubSessionConfig } from './ClubSessionConfig'

// Minimal i18n mock
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string) => {
      const map: Record<string, string> = {
        clubPlaySessionConfigTitle: '¿Cómo van a jugar?',
        clubPlayNameLabel: 'Nombre',
        clubPlayNamePlaceholder: 'Tu nombre',
        clubPlayPhoneLabel: 'Teléfono',
        clubPlayPhonePlaceholder: 'Tu teléfono',
        clubPlayModeFree: '🎯 Modo Libre',
        clubPlayModeFreeDesc: 'Sin puntuación',
        clubPlayModeMatch: '🏆 Modo Match',
        clubPlayModeMatchDesc: 'Partido con puntuación',
        clubPlayModeStart: 'Comenzar',
      }
      return map[key] || key
    },
  }),
}))

/**
 * Web Crypto mock — jsdom has no crypto.subtle so we provide a deterministic
 * stub. The mock returns a known ciphertext buffer so tests can verify the
 * encryption path was exercised and the output format is correct.
 */
function mockCrypto() {
  const importKey = vi.fn().mockResolvedValue('mock-aes-key')
  const encrypt = vi.fn().mockResolvedValue(
    new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c]).buffer,
  )
  const getRandomValues = (array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) array[i] = 0x11
    return array
  }
  return {
    subtle: { importKey, encrypt },
    getRandomValues,
    importKey,
    encrypt,
  }
}

function renderComponent(overrides: {
  onSelectFree?: (name: string, phone: string) => void
  onSelectMatch?: (name: string, phone: string) => void
  encryptionKey?: string
} = {}) {
  const onSelectFree = overrides.onSelectFree ?? vi.fn()
  const onSelectMatch = overrides.onSelectMatch ?? vi.fn()
  const encryptionKey = overrides.encryptionKey
  const result = render(
    <ClubSessionConfig
      onSelectFree={onSelectFree}
      onSelectMatch={onSelectMatch}
      encryptionKey={encryptionKey}
    />,
  )
  return { onSelectFree, onSelectMatch, ...result }
}

describe('ClubSessionConfig', () => {
  describe('name and phone inputs (player-identity)', () => {
    beforeEach(() => {
      vi.stubGlobal('crypto', mockCrypto())
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('renders name and phone inputs alongside mode options', () => {
      renderComponent()
      expect(screen.getByPlaceholderText('Tu nombre')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Tu teléfono')).toBeInTheDocument()
      expect(screen.getByText('🎯 Modo Libre')).toBeInTheDocument()
      expect(screen.getByText('🏆 Modo Match')).toBeInTheDocument()
    })

    it('Comenzar is disabled when name is empty (phone and mode filled)', () => {
      renderComponent()
      fireEvent.change(screen.getByPlaceholderText('Tu teléfono'), { target: { value: '1155551234' } })
      fireEvent.click(screen.getByText('🎯 Modo Libre'))
      expect(screen.getByRole('button', { name: /Comenzar/ })).toBeDisabled()
    })

    it('Comenzar is disabled when phone is empty (name and mode filled)', () => {
      renderComponent()
      fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Juan' } })
      fireEvent.click(screen.getByText('🎯 Modo Libre'))
      expect(screen.getByRole('button', { name: /Comenzar/ })).toBeDisabled()
    })

    it('Comenzar is disabled when both name and phone are empty', () => {
      renderComponent()
      fireEvent.click(screen.getByText('🎯 Modo Libre'))
      expect(screen.getByRole('button', { name: /Comenzar/ })).toBeDisabled()
    })

    it('Comenzar is enabled when name, phone, and mode are all provided', () => {
      renderComponent()
      fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Juan' } })
      fireEvent.change(screen.getByPlaceholderText('Tu teléfono'), { target: { value: '1155551234' } })
      fireEvent.click(screen.getByText('🎯 Modo Libre'))
      expect(screen.getByRole('button', { name: /Comenzar/ })).not.toBeDisabled()
    })

    it('submit without encryptionKey emits raw phone (graceful degradation)', async () => {
      const { onSelectFree } = renderComponent({ encryptionKey: undefined })
      fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Juan' } })
      fireEvent.change(screen.getByPlaceholderText('Tu teléfono'), { target: { value: '1155551234' } })
      fireEvent.click(screen.getByText('🎯 Modo Libre'))
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Comenzar/ }))
      })
      expect(onSelectFree).toHaveBeenCalledWith('Juan', '1155551234')
    })

    it('submit with encryptionKey calls Web Crypto and emits encrypted phone format', async () => {
      const { onSelectFree } = renderComponent({
        encryptionKey: 'dGVzdC1rZXktMzItYnl0ZXMtMTIzNDU2Nzg5MA==',
      })
      fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'María' } })
      fireEvent.change(screen.getByPlaceholderText('Tu teléfono'), { target: { value: '1166665678' } })
      fireEvent.click(screen.getByText('🎯 Modo Libre'))
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Comenzar/ }))
      })

      // Web Crypto was called
      const cryptoAny = (globalThis as any).crypto
      expect(cryptoAny.subtle.importKey).toHaveBeenCalled()
      expect(cryptoAny.subtle.encrypt).toHaveBeenCalled()

      // Phone emitted is NOT the raw value — it's encrypted
      const emittedPhone = onSelectFree.mock.calls[0][1]
      expect(emittedPhone).not.toBe('1166665678')
      // Format should match {nonceB64}:{ciphertextB64}:{authTagB64}
      expect(emittedPhone).toMatch(/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/)
    })

    it('submit with match mode emits onSelectMatch with name and encrypted phone', async () => {
      const { onSelectMatch } = renderComponent({
        encryptionKey: 'dGVzdC1rZXktMzItYnl0ZXMtMTIzNDU2Nzg5MA==',
      })
      fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Carlos' } })
      fireEvent.change(screen.getByPlaceholderText('Tu teléfono'), { target: { value: '1177770000' } })
      fireEvent.click(screen.getByText('🏆 Modo Match'))
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Comenzar/ }))
      })

      expect(onSelectMatch).toHaveBeenCalledTimes(1)
      const [emittedName, emittedPhone] = onSelectMatch.mock.calls[0]
      expect(emittedName).toBe('Carlos')
      expect(emittedPhone).not.toBe('1177770000')
      expect(emittedPhone).toMatch(/^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/)
    })

    it('encrypts phone with deterministic IV and returns correct format', async () => {
      const cryptoInst = mockCrypto()
      vi.stubGlobal('crypto', cryptoInst)

      // Override the mock encrypt to return bytes that produce a known base64 format
      const encoder = new TextEncoder()
      const nonceBytes = new Uint8Array(12)
      for (let i = 0; i < 12; i++) nonceBytes[i] = 0x21 // '!' char = 0x21
      const fakeCiphertext = encoder.encode('fake-cipher')
      const fakeAuthTag = new Uint8Array([0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19, 0x1a, 0x1b, 0x1c, 0x1d, 0x1e, 0x1f, 0x20])

      const combined = new Uint8Array(fakeCiphertext.length + fakeAuthTag.length)
      combined.set(fakeCiphertext)
      combined.set(fakeAuthTag, fakeCiphertext.length)

      cryptoInst.getRandomValues = vi.fn((arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = 0x21
        return arr
      })
      cryptoInst.subtle.encrypt = vi.fn().mockResolvedValue(combined.buffer)

      const { onSelectFree } = renderComponent({
        encryptionKey: 'dGVzdC1rZXktMzItYnl0ZXMtMTIzNDU2Nzg5MA==',
      })

      fireEvent.change(screen.getByPlaceholderText('Tu nombre'), { target: { value: 'Test' } })
      fireEvent.change(screen.getByPlaceholderText('Tu teléfono'), { target: { value: '1199998888' } })
      fireEvent.click(screen.getByText('🎯 Modo Libre'))
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /Comenzar/ }))
      })

      const emittedPhone = onSelectFree.mock.calls[0][1]
      // nonceB64 of 12 bytes 0x21: 12 * 0x21 = "ISEhISEhISEhISEh" (16 chars, no padding)
      expect(emittedPhone).toBe('ISEhISEhISEhISEh:ZmFrZS1jaXBoZXI=:ERITFBUWFxgZGhscHR4fIA==')
    })
  })
})
