/**
 * SocketHandlerBase Tests — comparePin + isOwner
 */

import { Server } from 'socket.io';
import { CourtManager } from '../src/domain/courtManager';
import { SocketHandlerBase } from '../src/handlers/SocketHandlerBase';

// Concrete subclass to access protected methods
class TestHandler extends SocketHandlerBase {
  public testComparePin(a: string, b: string): boolean {
    return this.comparePin(a, b);
  }

  public testIsOwner(pin?: string): boolean {
    return this.isOwner(pin);
  }
}

function createTestHandler(ownerPin: string = '12345678'): TestHandler {
  const io = {} as Server;
  const tableManager = {} as CourtManager;
  return new TestHandler(io, tableManager, ownerPin);
}

describe('SocketHandlerBase.comparePin', () => {
  test('returns true for matching PINs', () => {
    const handler = createTestHandler();
    expect(handler.testComparePin('1234', '1234')).toBe(true);
  });

  test('returns false for different PINs', () => {
    const handler = createTestHandler();
    expect(handler.testComparePin('1234', '5678')).toBe(false);
  });

  test('returns false for different length PINs', () => {
    const handler = createTestHandler();
    expect(handler.testComparePin('1234', '12345')).toBe(false);
  });

  test('returns true for matching owner PIN length 8', () => {
    const handler = createTestHandler('87654321');
    expect(handler.testComparePin('87654321', '87654321')).toBe(true);
  });
});

describe('SocketHandlerBase.isOwner', () => {
  test('returns true for matching owner PIN', () => {
    const handler = createTestHandler('12345678');
    expect(handler.testIsOwner('12345678')).toBe(true);
  });

  test('returns false for wrong owner PIN', () => {
    const handler = createTestHandler('12345678');
    expect(handler.testIsOwner('00000000')).toBe(false);
  });

  test('returns false for undefined PIN', () => {
    const handler = createTestHandler('12345678');
    expect(handler.testIsOwner(undefined)).toBe(false);
  });

  test('returns false for empty string', () => {
    const handler = createTestHandler('12345678');
    expect(handler.testIsOwner('')).toBe(false);
  });
});
