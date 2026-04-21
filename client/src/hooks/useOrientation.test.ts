import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOrientation } from './useOrientation';

describe('useOrientation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns initial isLandscape false', () => {
    const { result } = renderHook(() => useOrientation());
    expect(result.current.isLandscape).toBe(false);
  });

  it('toggle() switches isLandscape to true', () => {
    const { result } = renderHook(() => useOrientation());
    
    act(() => {
      result.current.toggle();
    });
    
    expect(result.current.isLandscape).toBe(true);
  });

  it('toggle() switches back to false', () => {
    const { result } = renderHook(() => useOrientation());
    
    act(() => {
      result.current.toggle();
    });
    expect(result.current.isLandscape).toBe(true);
    
    act(() => {
      result.current.toggle();
    });
    expect(result.current.isLandscape).toBe(false);
  });

  it('setLandscape(true) sets isLandscape to true', () => {
    const { result } = renderHook(() => useOrientation());
    
    act(() => {
      result.current.setLandscape(true);
    });
    
    expect(result.current.isLandscape).toBe(true);
  });

  it('setLandscape(false) sets isLandscape to false', () => {
    const { result } = renderHook(() => useOrientation());
    
    // First set to true
    act(() => {
      result.current.setLandscape(true);
    });
    expect(result.current.isLandscape).toBe(true);
    
    // Then set to false
    act(() => {
      result.current.setLandscape(false);
    });
    
    expect(result.current.isLandscape).toBe(false);
  });
});

describe('useOrientation localStorage persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists to localStorage when toggle is called', () => {
    const { result } = renderHook(() => useOrientation());
    
    act(() => {
      result.current.toggle();
    });
    
    expect(localStorage.getItem('orientation')).toBe('landscape');
  });

  it('persists to localStorage when setLandscape is called with true', () => {
    const { result } = renderHook(() => useOrientation());
    
    act(() => {
      result.current.setLandscape(true);
    });
    
    expect(localStorage.getItem('orientation')).toBe('landscape');
  });

  it('persists to localStorage when setLandscape is called with false', () => {
    const { result } = renderHook(() => useOrientation());
    
    act(() => {
      result.current.setLandscape(false);
    });
    
    expect(localStorage.getItem('orientation')).toBe('portrait');
  });

  it('reads from localStorage on init - landscape', () => {
    // Pre-set localStorage before hook initialization
    localStorage.setItem('orientation', 'landscape');
    
    const { result } = renderHook(() => useOrientation());
    
    expect(result.current.isLandscape).toBe(true);
  });

  it('reads from localStorage on init - portrait', () => {
    // Pre-set localStorage before hook initialization
    localStorage.setItem('orientation', 'portrait');
    
    const { result } = renderHook(() => useOrientation());
    
    expect(result.current.isLandscape).toBe(false);
  });
});

describe('useOrientation return shape', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns isLandscape, toggle, and setLandscape functions', () => {
    const { result } = renderHook(() => useOrientation());
    
    expect(typeof result.current.isLandscape).toBe('boolean');
    expect(typeof result.current.toggle).toBe('function');
    expect(typeof result.current.setLandscape).toBe('function');
  });
});