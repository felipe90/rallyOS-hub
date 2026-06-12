import { ReactNode } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { vi } from 'vitest'
import i18n from 'i18next'
import { initReactI18next, I18nextProvider } from 'react-i18next'
import { SocketContext, SocketContextType } from '@/contexts/SocketContext'
import { AuthProvider } from '@/contexts'
import es from '@/i18n/locales/es.json'

// Pre-configured test i18n instance — isolated from production i18n
const testI18n = i18n.createInstance()
void testI18n.use(initReactI18next).init({
  resources: { es: { translation: es } },
  lng: 'es',
  fallbackLng: 'es',
  interpolation: { escapeValue: false },
  returnNull: false,
})

const defaultMockSocketContext: SocketContextType = {
  socket: null,
  currentMatch: null,
  allHistories: null,
  courts: [],
  connected: true,
  connecting: false,
  error: null,
  errorCode: null,
  appError: null,
  currentCourt: null,
  emit: vi.fn(),
  createCourt: vi.fn(),
  joinCourt: vi.fn(),
  disconnect: vi.fn(),
  connect: vi.fn(),
  requestCourts: vi.fn(),
  requestCourtsWithPins: vi.fn(),
  scorePoint: vi.fn(),
  undoLastPoint: vi.fn(),
  startMatch: vi.fn((config?: { pointsPerSet: number; bestOf: number; playerNameA?: string; playerNameB?: string }) => {}),
  setReferee: vi.fn(),
  regeneratePin: vi.fn(),
  kioskNotification: null,
  hubConfig: null,
}

interface WrapperProps {
  children?: ReactNode
  mockSocketContext?: Partial<SocketContextType>
}

function TestWrapper({ children, mockSocketContext }: WrapperProps) {
  const socketValue = { ...defaultMockSocketContext, ...mockSocketContext }

  return (
    <AuthProvider>
      <SocketContext.Provider value={socketValue}>
        {children}
      </SocketContext.Provider>
    </AuthProvider>
  )
}

interface CustomRenderOptions extends WrapperProps {
  children?: ReactNode
}

function renderWithProviders(
  ui: React.ReactElement,
  options?: CustomRenderOptions
) {
  const { mockSocketContext, ...rest } = options || {}
  
  return render(ui, {
    wrapper: ({ children }) => (
      <TestWrapper mockSocketContext={mockSocketContext}>
        {children}
      </TestWrapper>
    ),
    ...rest,
  })
}

function renderWithI18n(
  ui: React.ReactElement,
  options?: CustomRenderOptions
) {
  const { mockSocketContext, ...rest } = options || {}
  return render(ui, {
    wrapper: ({ children }) => (
      <I18nextProvider i18n={testI18n}>
        <TestWrapper mockSocketContext={mockSocketContext}>
          {children}
        </TestWrapper>
      </I18nextProvider>
    ),
    ...rest,
  })
}

export * from '@testing-library/react'
export { renderWithProviders, renderWithI18n }