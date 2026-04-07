import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock matchMedia for jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock Framer Motion
vi.mock('framer-motion', () => ({
  motion: {
    div: 'div',
    span: 'span',
    button: 'button',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  useMotionValue: vi.fn(() => ({ value: 0 })),
  useTransform: vi.fn(),
  useSpring: vi.fn(),
}))

// Silence console warnings in tests
Object.defineProperty(window, 'console', {
  value: {
    ...console,
    warn: vi.fn(),
    error: vi.fn(),
  },
  writable: false,
})