/**
 * Socket Events Dictionary — Single Source of Truth
 *
 * All event names used by client and server.
 * CLIENT: events emitted by client → received by server
 * SERVER: events emitted by server → received by client
 *
 * Usage:
 *   Client: import { SocketEvents } from '@shared/events'
 *   Server: import { SocketEvents } from '../../shared/events'
 */

export const SocketEvents = {
  // Emitted by CLIENT → received by SERVER
  CLIENT: {
    CREATE_TABLE: 'CREATE_TABLE',
    JOIN_TABLE: 'JOIN_TABLE',
    LEAVE_TABLE: 'LEAVE_TABLE',
    LIST_TABLES: 'LIST_TABLES',
    GET_TABLES_WITH_PINS: 'GET_TABLES_WITH_PINS',
    GET_MATCH_STATE: 'GET_MATCH_STATE',
    SET_REF: 'SET_REF',
    REF_ROLE_CHECK: 'REF_ROLE_CHECK',
    DELETE_TABLE: 'DELETE_TABLE',
    VERIFY_OWNER: 'VERIFY_OWNER',
    CONFIGURE_MATCH: 'CONFIGURE_MATCH',
    START_MATCH: 'START_MATCH',
    RECORD_POINT: 'RECORD_POINT',
    SUBTRACT_POINT: 'SUBTRACT_POINT',
    UNDO_LAST: 'UNDO_LAST',
    SET_SERVER: 'SET_SERVER',
    RESET_TABLE: 'RESET_TABLE',
    REQUEST_TABLE_STATE: 'REQUEST_TABLE_STATE',
    REGENERATE_PIN: 'REGENERATE_PIN',
    GET_RATE_LIMIT_STATUS: 'GET_RATE_LIMIT_STATUS',
  },
  // Emitted by SERVER → received by CLIENT
  SERVER: {
    TABLE_LIST: 'TABLE_LIST',
    TABLE_LIST_WITH_PINS: 'TABLE_LIST_WITH_PINS',
    TABLE_UPDATE: 'TABLE_UPDATE',
    TABLE_CREATED: 'TABLE_CREATED',
    TABLE_JOINED: 'TABLE_JOINED',
    TABLE_DELETED: 'TABLE_DELETED',
    MATCH_UPDATE: 'MATCH_UPDATE',
    HISTORY_UPDATE: 'HISTORY_UPDATE',
    REF_SET: 'REF_SET',
    REF_ROLE_CHECK_RESULT: 'REF_ROLE_CHECK_RESULT',
    REF_REVOKED: 'REF_REVOKED',
    QR_DATA: 'QR_DATA',
    PIN_REGENERATED: 'PIN_REGENERATED',
    OWNER_VERIFIED: 'OWNER_VERIFIED',
    SET_WON: 'SET_WON',
    MATCH_WON: 'MATCH_WON',
    PLAYER_LEFT: 'PLAYER_LEFT',
    ERROR: 'ERROR',
    RATE_LIMIT_STATUS: 'RATE_LIMIT_STATUS',
  },
} as const;

export type ClientEvent = (typeof SocketEvents.CLIENT)[keyof typeof SocketEvents.CLIENT];
export type ServerEvent = (typeof SocketEvents.SERVER)[keyof typeof SocketEvents.SERVER];
