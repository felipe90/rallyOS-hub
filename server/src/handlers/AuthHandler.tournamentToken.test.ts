/**
 * Test: AuthHandler.VERIFY_OWNER emits tournamentToken in OWNER_VERIFIED.
 *
 * Spec requirement: After VERIFY_OWNER succeeds, the server MUST generate
 * a tournament auth token and emit it as part of the OWNER_VERIFIED event.
 */

import { AuthHandler } from './AuthHandler';
import type { Server, Socket } from 'socket.io';
import type { TableManager } from '../domain/courtManager';
import { SocketEvents } from '../../../shared/events';

// Intercept crypto.randomUUID to verify it was called
let mockUuidCounter = 0;
const MOCK_UUIDS = [
  'a1b2c3d4-e5f6-4abc-8def-0123456789ab',
  'b2c3d4e5-f6a7-4bcd-9efg-123456789abc',
];

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => {
    const uuid = MOCK_UUIDS[mockUuidCounter % MOCK_UUIDS.length];
    mockUuidCounter++;
    return uuid;
  }),
}));

function makeMockSocket(): Socket {
  const listeners = new Map<string, (...args: any[]) => void>();
  const emitted: Array<{ event: string; data: any }> = [];

  const socket: any = {
    id: 'mock-socket-id',
    data: { isOwner: false, isAuthenticated: false },
    handshake: { address: '127.0.0.1' },
    on: jest.fn((event: string, handler: (...args: any[]) => void) => {
      listeners.set(event, handler);
    }),
    emit: jest.fn((event: string, data: any) => {
      emitted.push({ event, data });
    }),
    join: jest.fn(),
    // Helpers for assertions
    _listeners: listeners,
    _emitted: emitted,
    _trigger: (event: string, data: any) => {
      const handler = listeners.get(event);
      if (handler) handler(data);
    },
  };

  return socket as unknown as Socket;
}

describe('AuthHandler VERIFY_OWNER — tournamentToken', () => {
  let mockIo: Server;
  let mockTableManager: TableManager;
  let socket: ReturnType<typeof makeMockSocket>;

  beforeEach(() => {
    mockUuidCounter = 0;

    mockIo = {
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      engine: { clientsCount: 0 },
    } as unknown as Server;

    mockTableManager = {
      setReferee: jest.fn(),
      getTable: jest.fn(),
      getAllTables: jest.fn().mockReturnValue([]),
      isReferee: jest.fn(),
    } as unknown as TableManager;

    socket = makeMockSocket();
  });

  it('should emit OWNER_VERIFIED with tournamentToken on successful PIN verification', () => {
    const handler = new AuthHandler(mockIo as Server, mockTableManager, '12345678');
    handler.registerHandlers(socket as unknown as Socket);

    // Trigger VERIFY_OWNER with correct PIN using the actual event name
    (socket as any)._trigger(SocketEvents.CLIENT.VERIFY_OWNER, { pin: '12345678' });

    // Verify OWNER_VERIFIED was emitted
    const emitted = (socket as any)._emitted as Array<{ event: string; data: any }>;
    const ownerVerifiedEvent = emitted.find((e: { event: string; data: any }) => e.event === SocketEvents.SERVER.OWNER_VERIFIED);
    expect(ownerVerifiedEvent).toBeDefined();

    // Check it contains both token and tournamentToken
    expect(ownerVerifiedEvent!.data.token).toBe('owner-session');
    expect(ownerVerifiedEvent!.data.tournamentToken).toBeDefined();
    expect(typeof ownerVerifiedEvent!.data.tournamentToken).toBe('string');
  });

  it('should emit a valid UUID v4 as tournamentToken', () => {
    const handler = new AuthHandler(mockIo as Server, mockTableManager, '12345678');
    handler.registerHandlers(socket as unknown as Socket);

    (socket as any)._trigger(SocketEvents.CLIENT.VERIFY_OWNER, { pin: '12345678' });

    const emitted = (socket as any)._emitted as Array<{ event: string; data: any }>;
    const ownerVerifiedEvent = emitted.find((e: { event: string; data: any }) => e.event === SocketEvents.SERVER.OWNER_VERIFIED);
    const token = ownerVerifiedEvent!.data.tournamentToken;

    const uuidV4Pattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(token).toMatch(uuidV4Pattern);
  });

  it('should NOT emit OWNER_VERIFIED when PIN is incorrect', () => {
    const handler = new AuthHandler(mockIo as Server, mockTableManager, '12345678');
    handler.registerHandlers(socket as unknown as Socket);

    (socket as any)._trigger(SocketEvents.CLIENT.VERIFY_OWNER, { pin: '00000000' });

    const emitted = (socket as any)._emitted as Array<{ event: string; data: any }>;
    const ownerVerifiedEvent = emitted.find((e: { event: string; data: any }) => e.event === SocketEvents.SERVER.OWNER_VERIFIED);
    expect(ownerVerifiedEvent).toBeUndefined();
  });
});
