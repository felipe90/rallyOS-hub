import { ReactNode } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { vi } from 'vitest'
import { SocketContext, SocketContextType } from '@/contexts/SocketContext'
import { AuthProvider } from '@/contexts'

const defaultMockSocketContext: SocketContextType = {
  socket: null,
  currentMatch: null,
  tables: [],
  connected: true,
  connecting: false,
  error: null,
  currentTable: null,
  emit: vi.fn(),
  createTable: vi.fn(),
  joinTable: vi.fn(),
  disconnect: vi.fn(),
  connect: vi.fn(),
  requestTables: vi.fn(),
  requestTablesWithPins: vi.fn(),
  scorePoint: vi.fn(),
  undoLastPoint: vi.fn(),
  startMatch: vi.fn(),
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

export * from '@testing-library/react'
export { renderWithProviders }