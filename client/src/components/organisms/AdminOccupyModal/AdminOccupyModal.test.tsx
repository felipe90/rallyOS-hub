/**
 * AdminOccupyModal tests (Phase 6.1 RED)
 *
 * Spec: admin-session-start
 * - Modal renders with name, phone, mode fields
 * - Submit button disabled until both name and phone non-empty
 * - Submit encrypts phone when encryptionKey provided
 * - Submit calls onSubmit with playerName, encryptedPhone, mode
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AdminOccupyModal } from './AdminOccupyModal'
import type { SessionMode } from '@shared/types'

// Mock i18n
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    i18nText: (key: string, params?: Record<string, string>) => {
      const map: Record<string, string> = {
        commonClose: 'Cerrar',
        clubAdminOccupyTitle: `Iniciar sesión — ${params?.courtName || ''}`,
        clubAdminOccupySubtitle: 'Complete los datos del jugador',
        clubAdminOccupyNamePlaceholder: 'Nombre del jugador',
        clubAdminOccupyPhonePlaceholder: 'Teléfono',
        clubAdminOccupyModeLabel: 'Modalidad',
        clubAdminOccupyModeFree: 'Libre',
        clubAdminOccupyModeMatch: 'Partido',
        clubAdminOccupySubmit: 'Iniciar Sesión',
      }
      return map[key] || key
    },
  }),
  changeLanguage: vi.fn(),
}))

// Mock encryptPhoneClient
vi.mock('@/shared/crypto/phoneEncryption', () => ({
  encryptPhoneClient: vi.fn((phone: string) =>
    Promise.resolve(`encrypted:${phone}`),
  ),
}))

describe('AdminOccupyModal (Phase 6.1)', () => {
  let onSubmit: ReturnType<typeof vi.fn>
  let onClose: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onSubmit = vi.fn()
    onClose = vi.fn()
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <AdminOccupyModal
        isOpen={false}
        courtName="Cancha 1"
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders modal with title, name, phone, mode fields when open', () => {
    render(
      <AdminOccupyModal
        isOpen={true}
        courtName="Cancha 1"
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )
    expect(screen.getByText('Iniciar sesión — Cancha 1')).toBeInTheDocument()
    expect(screen.getByText('Complete los datos del jugador')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Nombre del jugador')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Teléfono')).toBeInTheDocument()
    expect(screen.getByText('Libre')).toBeInTheDocument()
    expect(screen.getByText('Partido')).toBeInTheDocument()
  })

  it('submit button is disabled when name is empty', () => {
    render(
      <AdminOccupyModal
        isOpen={true}
        courtName="Cancha 1"
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )
    const submitBtn = screen.getByText('Iniciar Sesión')
    expect(submitBtn).toBeDisabled()
  })

  it('submit button is disabled when phone is empty', () => {
    render(
      <AdminOccupyModal
        isOpen={true}
        courtName="Cancha 1"
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText('Nombre del jugador'), {
      target: { value: 'Juan' },
    })
    const submitBtn = screen.getByText('Iniciar Sesión')
    expect(submitBtn).toBeDisabled()
  })

  it('submit button is enabled when name and phone are filled', () => {
    render(
      <AdminOccupyModal
        isOpen={true}
        courtName="Cancha 1"
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText('Nombre del jugador'), {
      target: { value: 'Juan' },
    })
    fireEvent.change(screen.getByPlaceholderText('Teléfono'), {
      target: { value: '1155550000' },
    })
    expect(screen.getByText('Iniciar Sesión')).not.toBeDisabled()
  })

  it('calls onClose when clicking backdrop', () => {
    render(
      <AdminOccupyModal
        isOpen={true}
        courtName="Cancha 1"
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )
    // Click the backdrop (first child of the fixed container)
    const backdrop = document.querySelector('.fixed.inset-0.z-50 > .absolute.inset-0')
    if (backdrop) fireEvent.click(backdrop)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking close button', () => {
    render(
      <AdminOccupyModal
        isOpen={true}
        courtName="Cancha 1"
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )
    const closeBtn = screen.getByLabelText('Cerrar')
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onSubmit with name, encrypted phone, and mode', async () => {
    render(
      <AdminOccupyModal
        isOpen={true}
        courtName="Cancha 1"
        encryptionKey="test-key-b64"
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText('Nombre del jugador'), {
      target: { value: 'Juan' },
    })
    fireEvent.change(screen.getByPlaceholderText('Teléfono'), {
      target: { value: '1155550000' },
    })
    fireEvent.click(screen.getByText('Iniciar Sesión'))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
    expect(onSubmit).toHaveBeenCalledWith('Juan', 'encrypted:1155550000', 'free')
  })

  it('calls onSubmit with match mode when match is selected', async () => {
    render(
      <AdminOccupyModal
        isOpen={true}
        courtName="Cancha 1"
        encryptionKey="test-key-b64"
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText('Nombre del jugador'), {
      target: { value: 'Juan' },
    })
    fireEvent.change(screen.getByPlaceholderText('Teléfono'), {
      target: { value: '1155550000' },
    })
    fireEvent.click(screen.getByText('Partido'))
    fireEvent.click(screen.getByText('Iniciar Sesión'))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
    expect(onSubmit).toHaveBeenCalledWith('Juan', 'encrypted:1155550000', 'match')
  })

  it('passes phone unencrypted when encryptionKey is null/undefined', async () => {
    render(
      <AdminOccupyModal
        isOpen={true}
        courtName="Cancha 1"
        encryptionKey={null}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText('Nombre del jugador'), {
      target: { value: 'Juan' },
    })
    fireEvent.change(screen.getByPlaceholderText('Teléfono'), {
      target: { value: '1155550000' },
    })
    fireEvent.click(screen.getByText('Iniciar Sesión'))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
    // No encryptionKey → sends raw phone
    expect(onSubmit).toHaveBeenCalledWith('Juan', '1155550000', 'free')
  })

  it('trims whitespace from name and phone', async () => {
    render(
      <AdminOccupyModal
        isOpen={true}
        courtName="Cancha 1"
        encryptionKey={null}
        onClose={onClose}
        onSubmit={onSubmit}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText('Nombre del jugador'), {
      target: { value: '  Juan  ' },
    })
    fireEvent.change(screen.getByPlaceholderText('Teléfono'), {
      target: { value: '  1155550000  ' },
    })
    fireEvent.click(screen.getByText('Iniciar Sesión'))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1)
    })
    expect(onSubmit).toHaveBeenCalledWith('Juan', '1155550000', 'free')
  })
})
