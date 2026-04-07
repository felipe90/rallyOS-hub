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
  const {
    serverUrl = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000',
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

    const socket = io(serverUrl, { transports: ['websocket'] });

    socket.on('connect', () => setState({ connected: true, connecting: false, error: null }));
    socket.on('disconnect', () => setState(s => ({ ...s, connected: false })));
    socket.on('connect_error', (error: Error) => setState({ connected: false, connecting: false, error: error.message }));

    socket.on('TABLE_UPDATE', (table: TableInfo) => {
      setTables(prev => prev.find(t => t.id === table.id) 
        ? prev.map(t => t.id === table.id ? table : t) 
        : [...prev, table]);
      setCurrentTable(table);
    });

    socket.on('TABLE_LIST', (list: TableInfo[]) => setTables(list));
    socket.on('MATCH_UPDATE', (match: MatchStateExtended) => setCurrentMatch(match));
    socket.on('HISTORY_UPDATE', (history: ScoreChange[]) => setCurrentMatch(prev => prev ? { ...prev, history } : null));

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
    joinTable,
    requestTables,
    scorePoint,
    undoLastPoint,
    startMatch,
    emit,
  };
}