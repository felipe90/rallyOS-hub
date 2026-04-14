import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { SocketEvents } from '@shared/events';
import type { TableInfo, TableInfoWithPin, MatchStateExtended, ScoreChange, ValidationError, ErrorResponse } from '../../../shared/types';

/* useSocket Hook - Centralized socket management */
export interface UseSocketOptions {
  serverUrl?: string;
  autoConnect?: boolean;
}

export interface SocketState {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  errorCode: string | null;
}

// Error messages map (Spanish)
const ERROR_MESSAGES: Record<string, string | ((error: ValidationError) => string)> = {
  'INVALID_PIN': 'PIN de mesa incorrecto',
  'INVALID_OWNER_PIN': 'PIN de organizador incorrecto',
  'RATE_LIMITED': 'Demasiados intentos. Esperá un minuto.',
  'REF_ALREADY_ACTIVE': 'Ya hay un árbitro activo en esta mesa',
  'TABLE_NOT_FOUND': 'Mesa no encontrada',
  'UNAUTHORIZED': 'No autorizado',
  'VALIDATION_ERROR': (error) => `Campo inválido: ${error.field} — ${error.message}`,
  'NOT_OWNER': 'No tenés permisos de organizador',
};

// Client-side validation helpers
const validateName = (name?: string): boolean =>
  !name || (typeof name === 'string' && name.length <= 256);

const validateTablePin = (pin: string): boolean => /^\d{4}$/.test(pin);

const validateOwnerPin = (pin: string): boolean => /^\d{5,8}$/.test(pin);

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
    errorCode: null,
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
      setState({ connected: true, connecting: false, error: null, errorCode: null });
    });
    socket.on('disconnect', (_reason) => {
      setState(s => ({ ...s, connected: false }));
    });
    socket.on('connect_error', (error: Error) => {
      setState({ connected: false, connecting: false, error: error.message, errorCode: null });
    });

    socket.on(SocketEvents.SERVER.TABLE_UPDATE, (table: TableInfo) => {
      setTables(prev => prev.find(t => t.id === table.id)
        ? prev.map(t => t.id === table.id ? table : t)
        : [...prev, table]);
      setCurrentTable(table);
    });

    socket.on(SocketEvents.SERVER.TABLE_LIST, (list: TableInfo[]) => setTables(list));
    socket.on(SocketEvents.SERVER.TABLE_LIST_WITH_PINS, (data: { tables: TableInfoWithPin[] }) => {
      setTables(data.tables as TableInfo[]);
    });
    socket.on(SocketEvents.SERVER.TABLE_CREATED, (_table: TableInfo) => {
      const ownerPin = localStorage.getItem('ownerPin')
      if (ownerPin) {
        socket.emit(SocketEvents.CLIENT.GET_TABLES_WITH_PINS, { ownerPin })
      }
    });
    socket.on(SocketEvents.SERVER.REF_SET, ({ tableId: _tableId }: { tableId: string }) => {
      // Referee successfully set by server
    });
    socket.on(SocketEvents.SERVER.MATCH_UPDATE, (match: MatchStateExtended) => {
      setCurrentMatch(match);
    });
    socket.on(SocketEvents.SERVER.HISTORY_UPDATE, (history: ScoreChange[]) => setCurrentMatch(prev => prev ? { ...prev, history } : null));

    // Differentiated error handling
    socket.on(SocketEvents.SERVER.ERROR, (error: ErrorResponse | ValidationError) => {
      let message: string;
      const code = error.code as keyof typeof ERROR_MESSAGES;
      if (error.code === 'VALIDATION_ERROR' && 'field' in error) {
        const validationError = error as ValidationError;
        message = validationError.message;
      } else {
        const msgFn = ERROR_MESSAGES[code];
        message = typeof msgFn === 'function' ? msgFn(error as ValidationError) : (msgFn || error.message);
      }
      setState(s => ({ ...s, error: message, errorCode: error.code }));
    });

    socketRef.current = socket;
  }, [serverUrl]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setState({ connected: false, connecting: false, error: null, errorCode: null });
    }
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    }
  }, []);

  const createTable = useCallback((name?: string) => {
    if (!validateName(name)) return;
    emit(SocketEvents.CLIENT.CREATE_TABLE, { name });
  }, [emit]);

  const joinTable = useCallback((tableId: string, pin: string, name?: string) => {
    if (!validateTablePin(pin)) return;
    if (!validateName(name)) return;
    emit(SocketEvents.CLIENT.JOIN_TABLE, { tableId, pin, name });
  }, [emit]);

  const requestTables = useCallback(() => emit(SocketEvents.CLIENT.LIST_TABLES), [emit]);
  const requestTablesWithPins = useCallback((ownerPin: string) => emit(SocketEvents.CLIENT.GET_TABLES_WITH_PINS, { ownerPin }), [emit]);

  const scorePoint = useCallback((player: 'A' | 'B') =>
    currentTable?.id && emit(SocketEvents.CLIENT.RECORD_POINT, { tableId: currentTable.id, player }),
    [emit, currentTable]
  );

  const undoLastPoint = useCallback(() =>
    currentTable?.id && emit(SocketEvents.CLIENT.UNDO_LAST, { tableId: currentTable.id }),
    [emit, currentTable]
  );

  const startMatch = useCallback((config: { pointsPerSet: number; bestOf: number; playerNameA?: string; playerNameB?: string } = { pointsPerSet: 15, bestOf: 3 }) =>
    currentTable?.id && emit(SocketEvents.CLIENT.START_MATCH, { tableId: currentTable.id, ...config }),
    [emit, currentTable]
  );

  const configureMatch = useCallback((config: { tableId?: string; playerNames?: { a: string; b: string }; format?: number; ptsPerSet?: number; handicap?: { a: number; b: number } }) => {
    if (currentTable?.id) {
      emit(SocketEvents.CLIENT.CONFIGURE_MATCH, { tableId: currentTable.id, ...config });
    }
  }, [emit, currentTable]);

  const setReferee = useCallback((tableId: string, pin: string) => {
    if (!validateTablePin(pin)) return;
    emit(SocketEvents.CLIENT.SET_REF, { tableId, pin });
  }, [emit]);

  const regeneratePin = useCallback((tableId: string, ownerPin: string) => {
    if (!validateOwnerPin(ownerPin)) return;
    emit(SocketEvents.CLIENT.REGENERATE_PIN, { tableId, pin: ownerPin });
  }, [emit]);

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
    requestTablesWithPins,
    scorePoint,
    undoLastPoint,
    startMatch,
    configureMatch,
    setReferee,
    regeneratePin,
    emit,
  };
}