import '@testing-library/jest-dom'
import { expect, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import React from 'react'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

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

// Mock de Framer Motion que renderiza elementos HTML reales
vi.mock('framer-motion', () => {
  // Factory para crear componentes que renderizan elementos HTML reales
  const createMotionElement = (element: string) => {
    return function MotionComponent({ children, ...props }: any) {
      return React.createElement(element, props, children)
    }
  }

  return {
    motion: {
      div: createMotionElement('div'),
      button: createMotionElement('button'),
      span: createMotionElement('span'),
      input: createMotionElement('input'),
      svg: createMotionElement('svg'),
      path: createMotionElement('path'),
      circle: createMotionElement('circle'),
      g: createMotionElement('g'),
      li: createMotionElement('li'),
      ul: createMotionElement('ul'),
      h1: createMotionElement('h1'),
      h2: createMotionElement('h2'),
      h3: createMotionElement('h3'),
      p: createMotionElement('p'),
      a: createMotionElement('a'),
      form: createMotionElement('form'),
      label: createMotionElement('label'),
    },
    AnimatePresence: ({ children }: { children?: React.ReactNode }) => children,
    useAnimation: () => ({
      start: vi.fn(),
      stop: vi.fn(),
    }),
    useMotionValue: vi.fn((initial: number) => ({
      value: initial,
      set: vi.fn(),
      get: vi.fn(() => initial),
      subscribe: () => () => {},
    })),
    useTransform: vi.fn((_value: any, _input: any[], output: any[]) => ({
      get: () => output[0] ?? 0,
    })),
    useSpring: vi.fn(() => ({
      get: () => 0,
    })),
    useReducedMotion: vi.fn(() => false),
    animate: vi.fn(),
    stagger: vi.fn(),
    pan: {},
    layout: {},
    variant: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
    },
  }
})
