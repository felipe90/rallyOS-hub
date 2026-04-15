import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MatchEngine } from '../src/matchEngine'

describe('MatchEngine', () => {
  let engine: MatchEngine

  beforeEach(() => {
    engine = new MatchEngine()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
  })

  describe('recordPoint', () => {
    it('should record point for side A', () => {
      engine.recordPoint('a', 1)
      const state = engine.getState()
      expect(state.score.a).toBe(1)
    })

    it('should record point for side B', () => {
      engine.recordPoint('b', 2)
      const state = engine.getState()
      expect(state.score.b).toBe(2)
    })

    it('should accumulate points', () => {
      engine.recordPoint('a', 1)
      engine.recordPoint('a', 1)
      engine.recordPoint('a', 1)
      const state = engine.getState()
      expect(state.score.a).toBe(3)
    })
  })

  describe('subtractPoint', () => {
    it('should subtract point from side A', () => {
      engine.recordPoint('a', 5)
      engine.subtractPoint('a', 1)
      const state = engine.getState()
      expect(state.score.a).toBe(4)
    })

    it('should not go below zero', () => {
      engine.subtractPoint('a', 1)
      const state = engine.getState()
      expect(state.score.a).toBe(0)
    })
  })

  describe('undoLast', () => {
    it('should undo last point', () => {
      engine.recordPoint('a', 5)
      const undone = engine.undoLast()
      expect(undone).toBe(true)
      const state = engine.getState()
      expect(state.score.a).toBe(0)
    })

    it('should return false when nothing to undo', () => {
      const undone = engine.undoLast()
      expect(undone).toBe(false)
    })
  })

  describe('checkSetWin', () => {
    it('should detect set win at 6 with 2 point lead', () => {
      // Play to 5-4
      for (let i = 0; i < 5; i++) engine.recordPoint('a', 1)
      for (let i = 0; i < 4; i++) engine.recordPoint('b', 1)
      
      engine.recordPoint('a', 1) // 6-4
      const won = engine.checkSetWin()
      expect(won).toBe(true)
    })

    it('should not win at 5-5 (continue)', () => {
      for (let i = 0; i < 5; i++) {
        engine.recordPoint('a', 1)
        engine.recordPoint('b', 1)
      }
      const won = engine.checkSetWin()
      expect(won).toBe(false)
    })
  })

  describe('checkMatchWin', () => {
    it('should detect match win', () => {
      // Win first set
      for (let i = 0; i < 6; i++) engine.recordPoint('a', 1)
      
      const won = engine.checkMatchWin()
      expect(won).toBe(true)
    })

    it('should not win mid-set', () => {
      engine.recordPoint('a', 3)
      const won = engine.checkMatchWin()
      expect(won).toBe(false)
    })
  })

  describe('configure', () => {
    it('should apply configuration', () => {
      engine.configure({ format: 3, ptsPerSet: 21 })
      const state = engine.getState()
      expect(state.format).toBe(3)
      expect(state.ptsPerSet).toBe(21)
    })
  })

  describe('reset', () => {
    it('should reset all state', () => {
      engine.recordPoint('a', 10)
      engine.reset()
      const state = engine.getState()
      expect(state.score.a).toBe(0)
      expect(state.score.b).toBe(0)
    })
  })

  describe('getState', () => {
    it('should return current state', () => {
      engine.recordPoint('a', 5)
      const state = engine.getState()
      expect(state.score.a).toBe(5)
      expect(state.status).toBe('WAITING')
    })
  })

  describe('canUndo', () => {
    it('should return true when history exists', () => {
      engine.recordPoint('a', 1)
      expect(engine.canUndo()).toBe(true)
    })

    it('should return false when no history', () => {
      expect(engine.canUndo()).toBe(false)
    })
  })

  describe('setServer', () => {
    it('should set which side serves', () => {
      engine.setServer('b')
      const state = engine.getState()
      expect(state.server).toBe('b')
    })
  })

  describe('handicap', () => {
    it('should apply handicap', () => {
      engine.configure({ handicap: { a: -5, b: 3 } })
      const state = engine.getState()
      expect(state.score.a).toBe(-5)
      expect(state.score.b).toBe(3)
    })
  })
})