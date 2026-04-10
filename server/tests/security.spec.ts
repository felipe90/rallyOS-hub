import { test, expect } from '@playwright/test';
import { io } from 'socket.io-client';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

test.describe('Security Tests - PIN Exposure (RF-01)', () => {
  
  test('TABLE_LIST does not expose pin in payload', async () => {
    const socket = io(`http://localhost:${PORT}`, {
      transports: ['websocket'],
      forceNew: true,
    });

    await socket.connect();
    
    // Request table list
    socket.emit('LIST_TABLES');
    
    const response = await new Promise<any>((resolve) => {
      socket.on('TABLE_LIST', (data) => {
        resolve(data);
      });
    });
    
    // Verify no pin in any table
    if (Array.isArray(response)) {
      response.forEach((table: any) => {
        // RF-01: pin should NOT be in public payload
        expect(table).not.toHaveProperty('pin');
      });
    }
    
    socket.disconnect();
  });

  test('TABLE_UPDATE does not expose pin in payload', async () => {
    const socket = io(`http://localhost:${PORT}`, {
      transports: ['websocket'],
      forceNew: true,
    });

    await socket.connect();
    
    // Create a table first
    socket.emit('CREATE_TABLE', { name: 'Test Table Security' });
    
    const response = await new Promise<any>((resolve) => {
      socket.on('TABLE_UPDATE', (data) => {
        resolve(data);
      });
    });
    
    // RF-01: Verify no pin in response
    expect(response).not.toHaveProperty('pin');
    
    socket.disconnect();
  });
});

test.describe('Security Tests - Authorization (RF-02)', () => {
  
  test('CREATE_TABLE promotes creator to referee - START_MATCH succeeds', async () => {
    const socket = io(`http://localhost:${PORT}`, {
      transports: ['websocket'],
      forceNew: true,
    });

    await socket.connect();
    
    // Create a table
    socket.emit('CREATE_TABLE', { name: 'RF-02 Test Table' });
    
    const tableCreated = await new Promise<any>((resolve) => {
      socket.on('TABLE_CREATED', (data) => {
        resolve(data);
      });
    });
    
    expect(tableCreated).toHaveProperty('tableId');
    
    // Start match without additional auth - should succeed (RF-02)
    socket.emit('START_MATCH', { 
      tableId: tableCreated.tableId,
      pointsPerSet: 11,
      bestOf: 3
    });
    
    const matchState = await new Promise<any>((resolve) => {
      socket.on('MATCH_UPDATE', (data) => {
        resolve(data);
      });
    });
    
    // Should NOT get UNAUTHORIZED error - creator is auto-authorized as referee
    expect(matchState).toBeDefined();
    expect(matchState.status).toBe('LIVE');
    
    socket.disconnect();
  });
});

test.describe('Security Tests - Rate Limiting (RF-03, RF-04)', () => {
  
  test('RF-03: rate-limit blocks SET_REF after 5 attempts', async () => {
    const socket = io(`http://localhost:${PORT}`, {
      transports: ['websocket'],
      forceNew: true,
    });

    await socket.connect();
    
    // Create table first
    socket.emit('CREATE_TABLE', { name: 'Rate Test SET_REF' });
    const tableCreated = await new Promise<any>((resolve) => {
      socket.on('TABLE_CREATED', (data) => resolve(data));
    });
    
    // Try to set referee 6 times (more than limit of 5)
    for (let i = 0; i < 6; i++) {
      socket.emit('SET_REF', { 
        tableId: tableCreated.tableId, 
        role: 'PLAYER_A',
        socketId: 'test-socket-' + i
      });
    }
    
    const errorResponse = await new Promise<any>((resolve) => {
      socket.on('ERROR', (data) => {
        resolve(data);
      });
    });
    
    // Should get RATE_LIMITED error on 6th attempt
    expect(errorResponse.code).toBe('RATE_LIMITED');
    
    socket.disconnect();
  });

  test('RF-04: rate-limit blocks DELETE_TABLE after 5 attempts', async () => {
    const socket = io(`http://localhost:${PORT}`, {
      transports: ['websocket'],
      forceNew: true,
    });

    await socket.connect();
    
    // Create table first
    socket.emit('CREATE_TABLE', { name: 'Delete Rate Test' });
    const tableCreated = await new Promise<any>((resolve) => {
      socket.on('TABLE_CREATED', (data) => resolve(data));
    });
    
    // Try to delete 6 times
    for (let i = 0; i < 6; i++) {
      socket.emit('DELETE_TABLE', { tableId: tableCreated.tableId });
    }
    
    const errorResponse = await new Promise<any>((resolve) => {
      socket.on('ERROR', (data) => {
        resolve(data);
      });
    });
    
    expect(errorResponse.code).toBe('RATE_LIMITED');
    
    socket.disconnect();
  });
});