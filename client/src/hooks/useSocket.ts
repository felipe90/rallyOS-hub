import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import type { TableInfo, MatchStateExtended, ScoreChange } from '../../../shared/types';

/* useSocket Hook - Centralized socket management */
export interface UseSocketOptions {
  serverUrl?: string;
  autoConnect?: boolean;
}

export interface SocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
}

export function useSocket(options: UseSocketOptions = {}) {
  // Auto-detect server URL if not provided
  // Uses window.location to determine the server origin
  const getDefaultServerUrl = () => {
    // If VITE_SERVER_URL is set (dev or custom), use it
    if (import.meta.env.VITE_SERVER_URL) {
      return import.meta.env.VITE_SERVER_URL;
    }
    
    // Otherwise, detect from current page location
    // This works for Docker, production, and local dev
    if (typeof window !== 'undefined') {
      // Use window.location origin (keeps protocol, domain, port from page)
      // But replace port if we're on dev server (5173) to connect to server (3000)
      const loc = window.location;
      const isDev = loc.port === '5173';
      
      if (isDev) {
        // Dev mode: client on :5173, server on :3000
        return `https://localhost:3000`;
      } else {
        // Production/Docker: same origin as the page
        return loc.origin;
      }
    }
    
    // Fallback (should never reach here in browser)
    return 'https://localhost:3000';
  };

  const {
    serverUrl = getDefaultServerUrl(),
    autoConnect = true,
  } = options;

  const socketRef = useRef<any>(null);
  const [state, setState] = useState<SocketState>({
    connected: false,
    connecting: false,
    error: null,
  });

  const [tables, setTables] = useState<TableInfo[]>([]);
  const [currentMatch, setCurrentMatch] = useState<MatchStateExtended | null>(null);
  const [currentTable, setCurrentTable] = useState<TableInfo | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;

    setState(s => ({ ...s, connecting: true, error: null }));

    // Socket.io options: auto-detect namespace and use both websocket and http long-polling as fallback
    const socket = io(serverUrl, { 
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });
    
    // Debug logging
    console.log('[Socket] Attempting connection to:', serverUrl);

    socket.on('connect', () => {
      console.log('[✓ Socket] Connected successfully');
      setState({ connected: true, connecting: false, error: null });
    });
    socket.on('disconnect', (reason) => {
      console.log('[✗ Socket] Disconnected:', reason);
      setState(s => ({ ...s, connected: false }));
    });
    socket.on('connect_error', (error: Error) => {
      console.error('[✗ Socket Error]', error.message);
      setState({ connected: false, connecting: false, error: error.message });
    });

    socket.on('TABLE_UPDATE', (table: TableInfo) => {
      setTables(prev => prev.find(t => t.id === table.id) 
        ? prev.map(t => t.id === table.id ? table : t) 
        : [...prev, table]);
      setCurrentTable(table);
    });

    socket.on('TABLE_LIST', (list: TableInfo[]) => setTables(list));
    socket.on('MATCH_UPDATE', (match: MatchStateExtended) => {
      setCurrentMatch(match);
    });
    socket.on('HISTORY_UPDATE', (history: ScoreChange[]) => setCurrentMatch(prev => prev ? { ...prev, history } : null));

    // Listen for errors
    socket.on('ERROR', (error: { code: string; message: string }) => {
      console.error('[Socket] Error from server:', error);
      setState(s => ({ ...s, error: error.message }));
    });

    // Listen for REF_SET confirmation
    socket.on('REF_SET', (data: { tableId: string }) => {
      console.log('[Socket] REF_SET confirmed for table:', data.tableId);
    });

    socketRef.current = socket;
  }, [serverUrl]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setState({ connected: false, connecting: false, error: null });
    }
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const createTable = useCallback((name?: string) => emit('CREATE_TABLE', { name }), [emit]);
  const joinTable = useCallback((tableId: string, pin: string, role: string) => emit('JOIN_TABLE', { tableId, pin, role }), [emit]);
  const requestTables = useCallback(() => emit('GET_TABLES', {}), [emit]);
  const scorePoint = useCallback((player: 'A' | 'B') => currentTable?.id && emit('SCORE_POINT', { tableId: currentTable.id, player }), [emit, currentTable]);
  const undoLastPoint = useCallback(() => currentTable?.id && emit('UNDO_POINT', { tableId: currentTable.id }), [emit, currentTable]);
  const startMatch = useCallback((config: { pointsPerSet: number; bestOf: number }) => currentTable?.id && emit('START_MATCH', { tableId: currentTable.id, ...config }), [emit, currentTable]);

  useEffect(() => {
    if (autoConnect) connect();
    return () => { disconnect(); };
  }, [autoConnect, connect, disconnect]);

  return {
    socket: socketRef.current,
    ...state,
    tables,
    currentTable,
    currentMatch,
    connect,
    disconnect,
    createTable,
    joinTable,
    requestTables,
    scorePoint,
    undoLastPoint,
    startMatch,
    emit,
  };
}