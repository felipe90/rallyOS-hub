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
    CREATE_COURT: 'CREATE_COURT',
    JOIN_COURT: 'JOIN_COURT',
    LEAVE_COURT: 'LEAVE_COURT',
    LIST_COURTS: 'LIST_COURTS',
    GET_COURTS_WITH_PINS: 'GET_COURTS_WITH_PINS',
    GET_MATCH_STATE: 'GET_MATCH_STATE',
    SET_REF: 'SET_REF',
    REF_ROLE_CHECK: 'REF_ROLE_CHECK',
    DELETE_COURT: 'DELETE_COURT',
    VERIFY_OWNER: 'VERIFY_OWNER',
    CONFIGURE_MATCH: 'CONFIGURE_MATCH',
    START_MATCH: 'START_MATCH',
    RECORD_POINT: 'RECORD_POINT',          // legacy — preserved for backward compat
    RECORD_SCORE: 'RECORD_SCORE',
    SUBTRACT_POINT: 'SUBTRACT_POINT',
    UNDO_LAST: 'UNDO_LAST',
    SET_SERVER: 'SET_SERVER',
    RESET_COURT: 'RESET_COURT',
    SWAP_SIDES: 'SWAP_SIDES',
    REQUEST_COURT_STATE: 'REQUEST_COURT_STATE',
    REGENERATE_PIN: 'REGENERATE_PIN',
    GET_RATE_LIMIT_STATUS: 'GET_RATE_LIMIT_STATUS',
    GET_ALL_HISTORY: 'GET_ALL_HISTORY',
    SEND_NOTIFICATION: 'SEND_NOTIFICATION',
    SET_FEATURED: 'SET_FEATURED',
    SUBSCRIBE_MATCH: 'SUBSCRIBE_MATCH',
    UNSUBSCRIBE_MATCH: 'UNSUBSCRIBE_MATCH',
  },
  // Emitted by SERVER → received by CLIENT
  SERVER: {
    COURT_LIST: 'COURT_LIST',
    COURT_LIST_WITH_PINS: 'COURT_LIST_WITH_PINS',
    COURT_UPDATE: 'COURT_UPDATE',
    COURT_CREATED: 'COURT_CREATED',
    COURT_JOINED: 'COURT_JOINED',
    COURT_DELETED: 'COURT_DELETED',
    MATCH_UPDATE: 'MATCH_UPDATE',
    ALL_HISTORY: 'ALL_HISTORY',
    REF_SET: 'REF_SET',
    REF_ROLE_CHECK_RESULT: 'REF_ROLE_CHECK_RESULT',
    REF_REVOKED: 'REF_REVOKED',
    QR_DATA: 'QR_DATA',
    PIN_REGENERATED: 'PIN_REGENERATED',
    OWNER_VERIFIED: 'OWNER_VERIFIED',
    SET_WON: 'SET_WON',
    GAME_WON: 'GAME_WON',
    DEUCE: 'DEUCE',
    TIEBREAK_START: 'TIEBREAK_START',
    MATCH_WON: 'MATCH_WON',
    PLAYER_LEFT: 'PLAYER_LEFT',
    ERROR: 'ERROR',
    RATE_LIMIT_STATUS: 'RATE_LIMIT_STATUS',
    HUB_CONFIG: 'HUB_CONFIG',
    KIOSK_NOTIFICATION: 'KIOSK_NOTIFICATION',
  },
} as const;

export type ClientEvent = (typeof SocketEvents.CLIENT)[keyof typeof SocketEvents.CLIENT];
export type ServerEvent = (typeof SocketEvents.SERVER)[keyof typeof SocketEvents.SERVER];
