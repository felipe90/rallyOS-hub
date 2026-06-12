/**
 * AdminHandler — SEND_NOTIFICATION tests (Phase 2.1 RED)
 *
 * These tests reference handler behavior that does NOT exist yet.
 * They will fail until AdminHandler.registerHandlers() wires SEND_NOTIFICATION.
 */

import { AdminHandler } from '../src/handlers/AdminHandler';
import { SocketEvents } from '../../shared/events';

function createMockSocket(ip = '127.0.0.1') {
  const handlers: Record<string, (...args: any[]) => void> = {};
  return {
    on: jest.fn((event: string, handler: (...args: any[]) => void) => {
      handlers[event] = handler;
    }),
    emit: jest.fn(),
    handshake: { address: ip },
    _handlers: handlers,
  };
}

function createMockIo() {
  return {
    emit: jest.fn(),
    to: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    socketsLeave: jest.fn(),
  };
}

function createMockTableManager() {
  return {
    getCourt: jest.fn(),
    getAllCourts: jest.fn(() => []),
    getAllCourtsWithPins: jest.fn(() => []),
    isReferee: jest.fn(() => false),
    getRefereeSocketId: jest.fn(() => undefined),
  } as any;
}

function setupAdminHandler(ownerPin = '12345678') {
  const mockIo = createMockIo();
  const mockTableManager = createMockTableManager();
  const handler = new AdminHandler(mockIo as any, mockTableManager, ownerPin);
  const mockSocket: any = createMockSocket();
  handler.registerHandlers(mockSocket);
  return { handler, mockIo, mockSocket };
}

// ── PIN Reject ─────────────────────────────────────────────────────

describe('AdminHandler SEND_NOTIFICATION — PIN validation', () => {
  test('rejects with wrong PIN, emits error, does NOT broadcast', () => {
    const { mockSocket, mockIo } = setupAdminHandler('12345678');

    const handler = mockSocket._handlers[SocketEvents.CLIENT.SEND_NOTIFICATION];
    expect(handler).toBeDefined();

    handler({ pin: '00000000', type: 'info', message: 'Hello', duration: 5 });

    expect(mockSocket.emit).toHaveBeenCalledWith('ERROR', expect.objectContaining({
      code: expect.any(String),
      message: expect.any(String),
    }));
    expect(mockIo.emit).not.toHaveBeenCalled();
  });

  test('rejects with empty PIN', () => {
    const { mockSocket, mockIo } = setupAdminHandler('12345678');

    const handler = mockSocket._handlers[SocketEvents.CLIENT.SEND_NOTIFICATION];
    handler({ pin: '', type: 'info', message: 'Hello', duration: 5 });

    expect(mockSocket.emit).toHaveBeenCalledWith('ERROR', expect.any(Object));
    expect(mockIo.emit).not.toHaveBeenCalled();
  });
});

// ── Rate Limit ─────────────────────────────────────────────────────

describe('AdminHandler SEND_NOTIFICATION — rate limiting', () => {
  test('allows 5 notifications from same IP, blocks 6th', () => {
    const { mockSocket, mockIo } = setupAdminHandler('12345678');

    const handler = mockSocket._handlers[SocketEvents.CLIENT.SEND_NOTIFICATION];
    expect(handler).toBeDefined();

    const msg = (n: number) => ({
      pin: '12345678',
      type: 'info' as const,
      message: `Message ${n}`,
      duration: 5,
    });

    // Send 5 — all should succeed
    for (let i = 0; i < 5; i++) {
      mockSocket.emit.mockClear();
      mockIo.emit.mockClear();
      handler(msg(i));
    }

    // Check the 5th succeeded
    expect(mockSocket.emit).not.toHaveBeenCalled();
    expect(mockIo.emit).toHaveBeenCalled();

    // 6th should be rate-limited
    mockSocket.emit.mockClear();
    mockIo.emit.mockClear();
    handler(msg(6));

    expect(mockSocket.emit).toHaveBeenCalledWith('ERROR', expect.objectContaining({
      code: expect.any(String),
    }));
    expect(mockIo.emit).not.toHaveBeenCalled();
  });

  test('different IPs have independent rate limits', () => {
    // Handler for IP A
    const { mockSocket: socketA, mockIo: ioA } = setupAdminHandler('12345678');
    const handlerA = socketA._handlers[SocketEvents.CLIENT.SEND_NOTIFICATION];

    // Handler for IP B (different AdminHandler instance, different socket/IP)
    const mockIo2 = createMockIo();
    const mockTableManager2 = createMockTableManager();
    const handler2 = new AdminHandler(mockIo2 as any, mockTableManager2, '12345678');
    const mockSocket2: any = createMockSocket('192.168.1.1');
    handler2.registerHandlers(mockSocket2);
    const handlerB = mockSocket2._handlers[SocketEvents.CLIENT.SEND_NOTIFICATION];

    const msg = () => ({
      pin: '12345678',
      type: 'info' as const,
      message: 'Test message',
      duration: 5,
    });

    // IP A: 5 notifications (all succeed)
    for (let i = 0; i < 5; i++) handlerA(msg());

    // IP B: 5 notifications — should NOT be rate-limited by A's count
    for (let i = 0; i < 5; i++) handlerB(msg());

    // IP B's 5th should have broadcasted, not errored
    expect(mockIo2.emit).toHaveBeenCalled();
    expect(mockSocket2.emit).not.toHaveBeenCalled();
  });
});

// ── HTML Stripping ─────────────────────────────────────────────────

describe('AdminHandler SEND_NOTIFICATION — HTML sanitization', () => {
  test('strips HTML tags from message in broadcast payload', () => {
    const { mockSocket, mockIo } = setupAdminHandler('12345678');

    const handler = mockSocket._handlers[SocketEvents.CLIENT.SEND_NOTIFICATION];
    handler({
      pin: '12345678',
      type: 'important',
      message: '<b>break</b>',
      duration: 10,
    });

    expect(mockIo.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.KIOSK_NOTIFICATION,
      expect.objectContaining({
        message: 'break',
      }),
    );
    expect(mockIo.emit).toHaveBeenCalledTimes(1);
  });

  test('sanitizes script tags and nested HTML', () => {
    const { mockSocket, mockIo } = setupAdminHandler('12345678');

    const handler = mockSocket._handlers[SocketEvents.CLIENT.SEND_NOTIFICATION];
    handler({
      pin: '12345678',
      type: 'error',
      message: '<script>alert(1)</script>',
      duration: 5,
    });

    expect(mockIo.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.KIOSK_NOTIFICATION,
      expect.objectContaining({
        message: 'alert(1)',
      }),
    );
  });
});

// ── Broadcast Payload Shape ────────────────────────────────────────

describe('AdminHandler SEND_NOTIFICATION — broadcast payload', () => {
  test('emits KIOSK_NOTIFICATION with correct payload shape', () => {
    const { mockSocket, mockIo } = setupAdminHandler('12345678');

    const handler = mockSocket._handlers[SocketEvents.CLIENT.SEND_NOTIFICATION];
    handler({
      pin: '12345678',
      type: 'warning',
      message: 'Court 4 is ready',
      duration: 15,
    });

    expect(mockIo.emit).toHaveBeenCalledWith(
      SocketEvents.SERVER.KIOSK_NOTIFICATION,
      expect.objectContaining({
        type: 'warning',
        message: 'Court 4 is ready',
        duration: 15,
      }),
    );

    const callArgs = mockIo.emit.mock.calls[0];
    const payload = callArgs[1];
    expect(payload).toHaveProperty('timestamp');
    expect(typeof payload.timestamp).toBe('number');
  });
});
