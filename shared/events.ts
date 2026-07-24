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
    // Club Mode
    CLUB_VERIFY_ADMIN: 'CLUB_VERIFY_ADMIN',
    CLUB_GET_CONFIG: 'CLUB_GET_CONFIG',
    CLUB_JOIN: 'CLUB_JOIN',
    CLUB_SETUP: 'CLUB_SETUP',
    CLUB_CREATE_COURT: 'CLUB_CREATE_COURT',
    CLUB_ACTIVATE_COURT: 'CLUB_ACTIVATE_COURT',
    CLUB_FORCE_END: 'CLUB_FORCE_END',
    CLUB_RECONNECT: 'CLUB_RECONNECT',
    CLUB_DELETE_COURT: 'CLUB_DELETE_COURT',
    CLUB_DEACTIVATE_COURT: 'CLUB_DEACTIVATE_COURT',
    CLUB_RESET_COURT: 'CLUB_RESET_COURT',
    CLUB_END_SESSION: 'CLUB_END_SESSION',
    // Club Session Lifecycle
    CLUB_START_FREE: 'CLUB_START_FREE',
    CLUB_RESET_MATCH: 'CLUB_RESET_MATCH',
    CLUB_NEW_MATCH: 'CLUB_NEW_MATCH',
    // Club Session History — admin requests history deletion (two-step
    // confirmation flow). See `club-session-history` spec: the server enters
    // a pending-clear state on CLUB_CLEAR_HISTORY and only acts after
    // CLUB_CLEAR_HISTORY_CONFIRM with confirm=true within 30s.
    CLUB_CLEAR_HISTORY: 'CLUB_CLEAR_HISTORY',
    CLUB_CLEAR_HISTORY_CONFIRM: 'CLUB_CLEAR_HISTORY_CONFIRM',
    // player-identity — admin takes an AVAILABLE court through the modal flow
    // (name + phone + mode) and occupies it without scanning a QR. See
    // `admin-session-start` spec.
    CLUB_ADMIN_OCCUPY: 'CLUB_ADMIN_OCCUPY',
    // player-identity — admin requests server-side decryption of a specific
    // session's stored phone. See `phone-reveal` spec: requires
    // socket.data.isClubAdmin === true; non-admin → unauthorized. Server
    // decrypts using ClubConfig.encryptionKey, never sends the key to the
    // admin client.
    CLUB_REVEAL_PHONE: 'CLUB_REVEAL_PHONE',
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
    // Club Mode
    CLUB_ADMIN_VERIFIED: 'CLUB_ADMIN_VERIFIED',
    CLUB_CONFIG: 'CLUB_CONFIG',
    CLUB_KIOSK_DATA: 'CLUB_KIOSK_DATA',
    CLUB_SETUP_COMPLETE: 'CLUB_SETUP_COMPLETE',
    CLUB_COURT_CREATED: 'CLUB_COURT_CREATED',
    CLUB_COURT_ACTIVATED: 'CLUB_COURT_ACTIVATED',
    CLUB_COURT_DEACTIVATED: 'CLUB_COURT_DEACTIVATED',
    CLUB_COURT_RESETTED: 'CLUB_COURT_RESETTED',
    CLUB_JOIN_RESULT: 'CLUB_JOIN_RESULT',
    CLUB_SESSION_ENDED: 'CLUB_SESSION_ENDED',
    CLUB_RECONNECT_RESULT: 'CLUB_RECONNECT_RESULT',
    CLUB_SESSION_RESTORED: 'CLUB_SESSION_RESTORED',
    // Club Session Lifecycle
    CLUB_FREE_STARTED: 'CLUB_FREE_STARTED',
    CLUB_MATCH_RESET: 'CLUB_MATCH_RESET',
    CLUB_SESSION_TIMER: 'CLUB_SESSION_TIMER',
    // Club Session History — S→C push of the full persisted session record
    // array. Emitted on admin socket connect (after auth) and on
    // CLUB_CLEAR_HISTORY_CONFIRM (with empty array, broadcast to ALL admin
    // sockets). See `club-session-history` spec.
    CLUB_SESSION_HISTORY: 'CLUB_SESSION_HISTORY',
    // PR 3 — dedicated confirmation signal for player-initiated
    // CLUB_END_SESSION. Previously the server reused CLUB_SESSION_TIMER to
    // carry the end-session confirmation payload, which forced the client to
    // disambiguate a periodic sync from a confirmation. CLUB_END_SESSION_CONFIRM
    // is S→C only and carries the same `{ courtId, elapsedSeconds }` payload.
    CLUB_END_SESSION_CONFIRM: 'CLUB_END_SESSION_CONFIRM',
    // player-identity — server response to CLUB_REVEAL_PHONE. Delivered ONLY
    // to the requesting admin socket. On success: { success: true, phone }.
    // On failure: { success: false, error: 'unauthorized' | 'not_found' }.
    // No audit entry is written on failure (spec: `phone-reveal` scenarios).
    CLUB_REVEAL_PHONE_RESULT: 'CLUB_REVEAL_PHONE_RESULT',
  },
} as const;

export type ClientEvent = (typeof SocketEvents.CLIENT)[keyof typeof SocketEvents.CLIENT];
export type ServerEvent = (typeof SocketEvents.SERVER)[keyof typeof SocketEvents.SERVER];
