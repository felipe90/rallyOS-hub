/**
 * ClubSessionHistoryHandler — Socket handler for admin session-history events.
 *
 * Spec: club-session-history / "Server Events" + "Authorization & Security".
 *
 * Events handled:
 *   - CLUB_CLEAR_HISTORY:        admin sets pending clear state + 30s timer
 *   - CLUB_CLEAR_HISTORY_CONFIRM: on confirm=true within 30s window, clears
 *     the store and broadcasts CLUB_SESSION_HISTORY([]) to ALL admin sockets.
 *
 * Authorization (spec: "Authorization & Security"):
 *   - Sockets with `socket.data.isClubAdmin !== true` are silently ignored
 *     for both events — no error is emitted back; a warning is logged. This
 *     matches the spec scenario "Non-admin socket rejected for
 *     CLUB_CLEAR_HISTORY".
 *
 * Broadcast semantics (spec: "Concurrent admin connections"):
 *   - On a confirmed clear, every connected admin socket receives the
 *     updated empty array — not just the requesting socket. This keeps
 *     multiple open admin dashboards consistent.
 *
 * Timeout:
 *   - The 30s pending-clear window is per-socket (Map<socketId, Timeout>).
 *   - On expiry the pending state is discarded SILENTLY — no broadcast, no
 *     clear, no error. The next CLUB_CLEAR_HISTORY_CONFIRM is a no-op.
 *   - The timer is `unref`'d so it does not keep the Node.js event loop
 *     alive during shutdown.
 */

import type { Server, Socket } from 'socket.io';
import { SocketEvents } from '../../../shared/events';
import type { SessionRecord } from '../../../shared/types';
import { logger } from '../utils/logger';
import { SessionHistoryStore } from '../services/store/SessionHistoryStore';

const CLEAR_TIMEOUT_MS = 30_000;

type SocketMap = Map<string, NodeJS.Timeout>;

export class ClubSessionHistoryHandler {
  private io: Server;
  private store: SessionHistoryStore;
  private pendingClear: SocketMap = new Map();

  constructor(io: Server, store: SessionHistoryStore) {
    this.io = io;
    this.store = store;
  }

  /**
   * Register club history admin handlers on the given socket. Idempotent —
   * safe to call once per connection.
   */
  public registerHandlers(socket: Socket): void {
    socket.on(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY, () => {
      if (!this.isAdmin(socket)) {
        logger.warn(
          { event: 'CLUB_CLEAR_HISTORY', socketId: socket.id },
          'ClubSessionHistoryHandler: non-admin socket attempted clear — ignored',
        );
        return;
      }
      this.startPendingClear(socket);
    });

    socket.on(SocketEvents.CLIENT.CLUB_CLEAR_HISTORY_CONFIRM, (data: { confirm?: unknown }) => {
      if (!this.isAdmin(socket)) {
        logger.warn(
          { event: 'CLUB_CLEAR_HISTORY_CONFIRM', socketId: socket.id },
          'ClubSessionHistoryHandler: non-admin socket attempted confirm — ignored',
        );
        return;
      }
      if (data?.confirm !== true) {
        // Spec: only confirm=true triggers the clear. Anything else is a no-op
        // (e.g. user clicked "cancel" in the confirmation UI).
        return;
      }
      if (!this.pendingClear.has(socket.id)) {
        // No pending clear — either never requested or already expired/cleared.
        return;
      }

      clearTimeout(this.pendingClear.get(socket.id)!);
      this.pendingClear.delete(socket.id);

      // Spec: clear the store, then broadcast the updated empty array to ALL
      // connected admin sockets (not just the requesting one).
      this.store.clear();
      this.broadcastHistoryToAdmins([]);

      logger.info(
        { socketId: socket.id },
        'ClubSessionHistoryHandler: history cleared and broadcast',
      );
    });

    // Clean up any pending timer on disconnect so we don't leak a Map entry.
    socket.on('disconnect', () => {
      const timer = this.pendingClear.get(socket.id);
      if (timer) {
        clearTimeout(timer);
        this.pendingClear.delete(socket.id);
      }
    });
  }

  /**
   * Emit the current session history snapshot to a single admin socket.
   * Used by SocketHandler to push history to an admin on socket connect.
   *
   * Non-admin sockets are silently skipped per spec ("Session history data
   * SHALL NEVER be sent to non-admin sockets").
   */
  public sendHistoryToSocket(socket: Socket): void {
    if (!this.isAdmin(socket)) {
      return;
    }
    socket.emit(SocketEvents.SERVER.CLUB_SESSION_HISTORY, {
      sessions: this.store.getAll(),
    });
  }

  // ── Internal helpers ────────────────────────────────────────────────

  /**
   * Silent admin guard — verifies `socket.data.isClubAdmin === true`.
   * Returns false WITHOUT emitting an error to the socket (spec: silent
   * ignore). The caller is responsible for logging the rejection.
   */
  private isAdmin(socket: Socket): boolean {
    const data = socket.data as { isClubAdmin?: unknown };
    return data?.isClubAdmin === true;
  }

  /**
   * Start (or replace) the 30s pending-clear timer for the given socket.
   * On expiry the pending state is discarded silently.
   */
  private startPendingClear(socket: Socket): void {
    // If a previous pending clear is still active for this socket, reset the
    // window — the admin re-requested and the 30s timer restarts.
    const existing = this.pendingClear.get(socket.id);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.pendingClear.delete(socket.id);
      logger.debug(
        { socketId: socket.id },
        'ClubSessionHistoryHandler: pending clear expired (30s) — discarded',
      );
    }, CLEAR_TIMEOUT_MS);

    // unref so the timer does not keep the event loop alive during shutdown.
    if (typeof (timer as NodeJS.Timeout).unref === 'function') {
      (timer as NodeJS.Timeout).unref();
    }

    this.pendingClear.set(socket.id, timer);
  }

  /**
   * Iterate over every connected socket and emit the supplied records to
   * those whose `socket.data.isClubAdmin === true`. Used after a clear to
   * broadcast the empty array to ALL open admin dashboards (spec:
   * "Concurrent admin connections").
   */
  private broadcastHistoryToAdmins(records: SessionRecord[]): void {
    const sockets = (this.io.sockets as unknown as {
      sockets: Map<string, Socket>;
    }).sockets;

    if (!sockets || typeof sockets.values !== 'function') {
      return;
    }

    for (const socket of sockets.values()) {
      const data = socket.data as { isClubAdmin?: unknown } | undefined;
      if (data?.isClubAdmin === true) {
        socket.emit(SocketEvents.SERVER.CLUB_SESSION_HISTORY, { sessions: records });
      }
    }
  }
}