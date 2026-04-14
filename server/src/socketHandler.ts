import { Server, Socket } from 'socket.io';
import { TableManager } from './tableManager';
import { MatchEngine, Player, MatchConfig } from './matchEngine';
import { TableInfo } from './types';
import { validateSocketPayload, ValidationRules } from './utils/validation';
import { logger } from './utils/logger';
import { SocketEvents } from '../../shared/events';

export class SocketHandler {
  private io: Server;
  private tableManager: TableManager;
  private ownerPin: string;
  private readonly rateLimitWindowMs = 60_000;
  private readonly rateLimitMaxAttempts = 5;
  private rateLimitAttempts: Map<string, number[]> = new Map();

  constructor(io: Server, tableManager: TableManager, ownerPin: string) {
    this.io = io;
    this.tableManager = tableManager;
    this.ownerPin = ownerPin;
    
    // Set up global table update listener once
    this.tableManager.onTableUpdate = (tableInfo) => {
      this.io.emit(SocketEvents.SERVER.TABLE_UPDATE, this.toPublicTableInfo(tableInfo));
      this.io.emit(SocketEvents.SERVER.TABLE_LIST, this.getPublicTableList());
    };

    this.tableManager.onMatchEvent = (tableId, event) => {
      if (event.type === 'SET_WON') {
        this.io.to(tableId).emit(SocketEvents.SERVER.SET_WON, { tableId, ...event });
      } else if (event.type === 'MATCH_WON') {
        this.io.to(tableId).emit(SocketEvents.SERVER.MATCH_WON, { tableId, ...event });
      }
    };
    
    this.setupListeners();
  }

  private setupListeners() {
    this.io.on('connection', (socket: Socket) => {
      logger.info({ socketId: socket.id }, 'Client connected');
      logger.debug({ socketId: socket.id, count: this.io.engine.clientsCount }, 'Connected clients');

      // Send current tables to new client
      socket.emit(SocketEvents.SERVER.TABLE_LIST, this.getPublicTableList());

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info({ socketId: socket.id, reason }, 'Client disconnected');
        logger.debug({ count: this.io.engine.clientsCount }, 'Connected clients after disconnect');
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error({ socketId: socket.id, error }, 'Socket error');
      });

      socket.on(SocketEvents.CLIENT.CREATE_TABLE, (data?: { name?: string }) => {
        if (!validateSocketPayload(socket, data || {}, { name: { type: 'string', maxLength: 256, required: false } }, 'CREATE_TABLE')) {
          return;
        }

        const table = this.tableManager.createTable(data?.name);
        socket.join(table.id); // Creator joins the table room

        // POC UX: the table creator is trusted as initial referee for that table.
        // This avoids relying on exposing/storing table PIN on the client.
        this.tableManager.joinTable(table.id, socket.id, 'Referee');
        this.tableManager.setReferee(table.id, socket.id, table.pin);
        
        socket.emit(SocketEvents.SERVER.TABLE_CREATED, this.tableManager.tableToInfo(table));
        socket.emit(SocketEvents.SERVER.REF_SET, { tableId: table.id });

        const qrData = this.tableManager.generateQRData(table.id);
        if (qrData) {
          socket.emit(SocketEvents.SERVER.QR_DATA, qrData);
        }

        socket.emit(SocketEvents.SERVER.MATCH_UPDATE, this.tableManager.getMatchState(table.id));
      });
      
      socket.on(SocketEvents.CLIENT.LIST_TABLES, () => {
        socket.emit(SocketEvents.SERVER.TABLE_LIST, this.getPublicTableList());
      });

      socket.on(SocketEvents.CLIENT.GET_MATCH_STATE, (data: { tableId: string }) => {
        if (!validateSocketPayload(socket, data, { tableId: { required: true, type: 'string', maxLength: 36 } }, 'GET_MATCH_STATE')) {
          return;
        }

        if (!data?.tableId) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'INVALID_PARAMS', message: 'tableId required' });
        }

        const state = this.tableManager.getMatchState(data.tableId);
        if (state) {
          socket.emit(SocketEvents.SERVER.MATCH_UPDATE, state);
        } else {
          socket.emit(SocketEvents.SERVER.ERROR, { code: 'TABLE_NOT_FOUND', message: 'Partido no encontrado' });
        }
      });

      socket.on(SocketEvents.CLIENT.JOIN_TABLE, (data: { tableId: string; name?: string; pin?: string; role?: string }) => {
        if (!validateSocketPayload(socket, data, { tableId: { required: true, type: 'string', maxLength: 36 }, name: { type: 'string', maxLength: 256, required: false }, pin: { type: 'string', pattern: /^\d{4}$/, required: false } }, 'JOIN_TABLE')) {
          return;
        }

        if (!data?.tableId) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'INVALID_PARAMS', message: 'tableId required' });
        }

        const playerName = data.name || `Espectador ${socket.id.slice(0, 6)}`;
        const success = this.tableManager.joinTable(data.tableId, socket.id, playerName, data.pin);

        if (success) {
          socket.join(data.tableId); // JOIN the socket room for this table
          socket.emit(SocketEvents.SERVER.TABLE_JOINED, { tableId: data.tableId });

          const tableInfo = this.tableManager.getAllTables().find(t => t.id === data.tableId);
          if (tableInfo) {
            socket.emit(SocketEvents.SERVER.TABLE_UPDATE, this.toPublicTableInfo(tableInfo));
          }

          const state = this.tableManager.getMatchState(data.tableId);
          if (state) {
            socket.emit(SocketEvents.SERVER.MATCH_UPDATE, state);
          }
        } else {
          // Check if it's a PIN error
          const table = this.tableManager.getAllTables().find(t => t.id === data.tableId);
          if (table && data.pin) {
            socket.emit(SocketEvents.SERVER.ERROR, { code: 'INVALID_PIN', message: 'PIN incorrecto' });
          } else {
            socket.emit(SocketEvents.SERVER.ERROR, { code: 'TABLE_NOT_FOUND', message: 'Mesa no encontrada' });
          }
        }
      });

      socket.on(SocketEvents.CLIENT.LEAVE_TABLE, (data: { tableId: string }) => {
        if (!validateSocketPayload(socket, data, { tableId: { required: true, type: 'string', maxLength: 36 } }, 'LEAVE_TABLE')) {
          return;
        }

        if (!data?.tableId) return;
        
        socket.leave(data.tableId); // LEAVE the socket room
        
        const table = this.tableManager.getTable(data.tableId);
        if (!table) return;
        
        const player = table.players.find(p => p.socketId === socket.id);
        if (player) {
          this.tableManager.leaveTable(data.tableId, socket.id);
          this.io.to(data.tableId).emit(SocketEvents.SERVER.PLAYER_LEFT, { tableId: data.tableId, socketId: socket.id });
        }
      });

      socket.on(SocketEvents.CLIENT.SET_REF, (data: { tableId: string; pin: string }) => {
        if (!validateSocketPayload(socket, data, { tableId: { required: true, type: 'string', maxLength: 36 }, pin: { required: true, type: 'string', pattern: /^\d{4}$/ } }, 'SET_REF')) {
          return;
        }

        if (!data?.tableId || !data?.pin) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'INVALID_PARAMS', message: 'tableId and pin required' });
        }

        const clientIp = socket.handshake.address;
        const rateLimitKey = `SET_REF:${data.tableId}:${clientIp}`;
        if (this.isRateLimited(rateLimitKey)) {
          logger.warn({ tableId: data.tableId, ip: clientIp }, 'SET_REF rate limit blocked');
          return socket.emit(SocketEvents.SERVER.ERROR, {
            code: 'RATE_LIMITED',
            message: 'Too many attempts. Please wait a minute before trying again.',
          });
        }
        
        const validOwnerPin = this.ownerPin;
        const isOwnerPin = data.pin === validOwnerPin;
        
        let success = false;
        
        if (isOwnerPin) {
          // Owner PIN can take control regardless of existing referee
          success = this.tableManager.setReferee(data.tableId, socket.id, data.pin);
          
          // If failed, force remove previous referee and retry
          if (!success) {
            const table = this.tableManager.getTable(data.tableId);
            if (table) {
              const existingRef = table.players.find(p => p.role === 'REFEREE');
              if (existingRef) {
                logger.info({ tableId: data.tableId, oldRefereeId: existingRef.socketId }, 'Owner taking control, removing old referee');
                // Remove old referee
                table.players = table.players.filter(p => p.role !== 'REFEREE');
              }
            }
            success = this.tableManager.setReferee(data.tableId, socket.id, data.pin);
          }
        } else {
          success = this.tableManager.setReferee(data.tableId, socket.id, data.pin);
        }
        
        if (success) {
          socket.join(data.tableId); // Ensure referee is in the room
          socket.emit(SocketEvents.SERVER.REF_SET, { tableId: data.tableId });

          const tableInfo = this.tableManager.getAllTables().find(t => t.id === data.tableId);
          if (tableInfo) {
            this.io.emit(SocketEvents.SERVER.TABLE_UPDATE, this.toPublicTableInfo(tableInfo)); // Update global dashboard
          }
        } else {
          // Check if it's because there's already an active referee
          const table = this.tableManager.getTable(data.tableId);
          if (table) {
            const existingRef = table.players.find(p => p.role === 'REFEREE');
            if (existingRef && existingRef.socketId !== socket.id) {
              return socket.emit(SocketEvents.SERVER.ERROR, { code: 'REF_ALREADY_ACTIVE', message: 'Ya hay un árbitro activo en esta mesa' });
            }
          }
          socket.emit(SocketEvents.SERVER.ERROR, { code: 'INVALID_PIN', message: 'PIN incorrecto' });
        }
      });

      socket.on(SocketEvents.CLIENT.CONFIGURE_MATCH, (data: {
        tableId: string;
        playerNames?: { a: string; b: string };
        format?: number;
        ptsPerSet?: number;
        handicap?: { a: number; b: number }
      }) => {
        if (!validateSocketPayload(socket, data, { tableId: { required: true, type: 'string', maxLength: 36 }, playerNames: { type: 'object', required: false }, matchConfig: { type: 'object', required: false } }, 'CONFIGURE_MATCH')) {
          return;
        }

        if (!data?.tableId) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'INVALID_PARAMS', message: 'tableId required' });
        }

        if (!this.tableManager.isReferee(data.tableId, socket.id)) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'UNAUTHORIZED', message: 'No autorizado' });
        }

        // Map UI data to MatchConfig
        const matchConfig: any = {};
        if (data.format) matchConfig.bestOf = data.format;
        if (data.ptsPerSet) matchConfig.pointsPerSet = data.ptsPerSet;
        if (data.handicap) {
          matchConfig.initialScore = { a: data.handicap.a, b: data.handicap.b };
        }

        this.tableManager.configureMatch(data.tableId, {
          playerNames: data.playerNames,
          matchConfig: matchConfig
        });

        // Emit TABLE_UPDATE so Dashboard sees the updated player names
        const table = this.tableManager.getTable(data.tableId);
        if (table) {
          const tableInfo = this.tableManager.tableToInfo(table);
          this.io.emit(SocketEvents.SERVER.TABLE_UPDATE, this.toPublicTableInfo(tableInfo));
        }

        const state = this.tableManager.getMatchState(data.tableId);
        if (state) {
          this.io.to(data.tableId).emit(SocketEvents.SERVER.MATCH_UPDATE, state); // Emit only to room
        }
      });

      socket.on(SocketEvents.CLIENT.START_MATCH, (data: { 
        tableId: string;
        pointsPerSet?: number;
        bestOf?: number;
        handicapA?: number;
        handicapB?: number;
        playerNameA?: string;
        playerNameB?: string;
      }) => {
        if (!validateSocketPayload(socket, data, { tableId: { required: true, type: 'string', maxLength: 36 } }, 'START_MATCH')) {
          return;
        }

        logger.info({ tableId: data.tableId }, 'START_MATCH received');

        if (!data?.tableId) {
          logger.warn('START_MATCH: tableId missing');
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'INVALID_PARAMS', message: 'tableId required' });
        }

        if (!this.tableManager.isReferee(data.tableId, socket.id)) {
          logger.warn({ tableId: data.tableId }, 'START_MATCH: Not a referee for table');
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'UNAUTHORIZED', message: 'No autorizado' });
        }

        // Configure player names before starting match
        if (data.playerNameA || data.playerNameB) {
          this.tableManager.configureMatch(data.tableId, {
            playerNames: { 
              a: data.playerNameA || 'Player A', 
              b: data.playerNameB || 'Player B' 
            }
          });
        }

        // START_MATCH only initiates the match - configuration should be done via CONFIGURE_MATCH
        const state = this.tableManager.startMatch(data.tableId);

        logger.debug({ tableId: data.tableId, state }, 'START_MATCH: Result state');

        // Emit TABLE_UPDATE so Dashboard sees updated player names
        const table = this.tableManager.getTable(data.tableId);
        if (table) {
          const tableInfo = this.tableManager.tableToInfo(table);
          this.io.emit(SocketEvents.SERVER.TABLE_UPDATE, this.toPublicTableInfo(tableInfo));
        }

        if (state) {
          logger.debug({ tableId: data.tableId }, 'START_MATCH: Emitting MATCH_UPDATE to room');
          this.io.to(data.tableId).emit(SocketEvents.SERVER.MATCH_UPDATE, state);
        } else {
          logger.warn({ tableId: data.tableId }, 'START_MATCH: tableManager.startMatch returned null');
        }
      });

      socket.on(SocketEvents.CLIENT.RECORD_POINT, (data: { tableId: string; player: Player }) => {
        if (!validateSocketPayload(socket, data, { tableId: { required: true, type: 'string', maxLength: 36 }, player: { required: true, type: 'string', enum: ['A', 'B'] } }, 'RECORD_POINT')) {
          return;
        }

        if (!data?.tableId || !data?.player) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'INVALID_PARAMS', message: 'tableId and player required' });
        }

        if (!this.tableManager.isReferee(data.tableId, socket.id)) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'UNAUTHORIZED', message: 'No autorizado' });
        }

        const state = this.tableManager.recordPoint(data.tableId, data.player);
        if (state) {
          this.io.to(data.tableId).emit(SocketEvents.SERVER.MATCH_UPDATE, state); // Emit only to room
        }
      });

      socket.on(SocketEvents.CLIENT.SUBTRACT_POINT, (data: { tableId: string; player: Player }) => {
        if (!validateSocketPayload(socket, data, { tableId: { required: true, type: 'string', maxLength: 36 }, player: { required: true, type: 'string', enum: ['A', 'B'] } }, 'SUBTRACT_POINT')) {
          return;
        }

        if (!data?.tableId || !data?.player) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'INVALID_PARAMS', message: 'tableId and player required' });
        }

        if (!this.tableManager.isReferee(data.tableId, socket.id)) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'UNAUTHORIZED', message: 'No autorizado' });
        }

        const state = this.tableManager.subtractPoint(data.tableId, data.player);
        if (state) {
          this.io.to(data.tableId).emit(SocketEvents.SERVER.MATCH_UPDATE, state); // Emit only to room
        }
      });

      socket.on(SocketEvents.CLIENT.UNDO_LAST, (data: { tableId: string }) => {
        if (!validateSocketPayload(socket, data, { tableId: { required: true, type: 'string', maxLength: 36 } }, 'UNDO_LAST')) {
          return;
        }

        if (!data?.tableId) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'INVALID_PARAMS', message: 'tableId required' });
        }

        if (!this.tableManager.isReferee(data.tableId, socket.id)) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'UNAUTHORIZED', message: 'No autorizado' });
        }

        const state = this.tableManager.undoLast(data.tableId);
        if (state) {
          this.io.to(data.tableId).emit(SocketEvents.SERVER.MATCH_UPDATE, state); // Emit only to room
        }
      });

      socket.on(SocketEvents.CLIENT.SET_SERVER, (data: { tableId: string; player: Player }) => {
        if (!validateSocketPayload(socket, data, { tableId: { required: true, type: 'string', maxLength: 36 }, player: { required: true, type: 'string', enum: ['A', 'B'] } }, 'SET_SERVER')) {
          return;
        }

        if (!data?.tableId || !data?.player) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'INVALID_PARAMS', message: 'tableId and player required' });
        }

        if (!this.tableManager.isReferee(data.tableId, socket.id)) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'UNAUTHORIZED', message: 'No autorizado' });
        }

        const state = this.tableManager.setServer(data.tableId, data.player);
        if (state) {
          this.io.to(data.tableId).emit(SocketEvents.SERVER.MATCH_UPDATE, state); // Emit only to room
        }
      });

      socket.on(SocketEvents.CLIENT.RESET_TABLE, (data: { tableId: string; config?: MatchConfig }) => {
        if (!validateSocketPayload(socket, data, { tableId: { required: true, type: 'string', maxLength: 36 }, config: { type: 'object', required: false } }, 'RESET_TABLE')) {
          return;
        }

        if (!data?.tableId) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'INVALID_PARAMS', message: 'tableId required' });
        }

        if (!this.tableManager.isReferee(data.tableId, socket.id)) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'UNAUTHORIZED', message: 'No autorizado' });
        }

        const state = this.tableManager.resetTable(data.tableId, data.config);
        if (state) {
          this.io.to(data.tableId).emit(SocketEvents.SERVER.MATCH_UPDATE, state); // Emit only to room
        }
      });

      socket.on(SocketEvents.CLIENT.REQUEST_TABLE_STATE, (data: { tableId: string }) => {
        if (!validateSocketPayload(socket, data, { tableId: { required: true, type: 'string', maxLength: 36 } }, 'REQUEST_TABLE_STATE')) {
          return;
        }

        if (!data?.tableId) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'INVALID_PARAMS', message: 'tableId required' });
        }

        const state = this.tableManager.getMatchState(data.tableId);
        if (state) {
          socket.emit(SocketEvents.SERVER.MATCH_UPDATE, state);
        } else {
          socket.emit(SocketEvents.SERVER.ERROR, { code: 'TABLE_NOT_FOUND', message: 'Mesa no encontrada' });
        }
      });

      socket.on(SocketEvents.CLIENT.DELETE_TABLE, (data: { tableId: string; pin: string }) => {
        if (!validateSocketPayload(socket, data, { tableId: { required: true, type: 'string', maxLength: 36 }, pin: { required: true, type: 'string', pattern: /^\d{4}$/ } }, 'DELETE_TABLE')) {
          return;
        }

        if (!data?.tableId || !data?.pin) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'INVALID_PARAMS', message: 'tableId and pin required' });
        }

        const clientIp = socket.handshake.address;
        const rateLimitKey = `DELETE_TABLE:${data.tableId}:${clientIp}`;
        if (this.isRateLimited(rateLimitKey)) {
          logger.warn({ tableId: data.tableId, ip: clientIp }, 'DELETE_TABLE rate limit blocked');
          return socket.emit(SocketEvents.SERVER.ERROR, {
            code: 'RATE_LIMITED',
            message: 'Too many attempts. Please wait a minute before trying again.',
          });
        }

        const table = this.tableManager.getTable(data.tableId);
        if (!table) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'TABLE_NOT_FOUND', message: 'Mesa no encontrada' });
        }

        if (table.pin !== data.pin) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'INVALID_PIN', message: 'PIN incorrecto' });
        }

        // Notify room members that the table is gone
        this.io.to(data.tableId).emit(SocketEvents.SERVER.TABLE_DELETED, { tableId: data.tableId });

        // Force everyone out of the socket room
        this.io.in(data.tableId).socketsLeave(data.tableId);

        // Delete from manager
        const success = this.tableManager.deleteTable(data.tableId);

        if (success) {
          logger.info({ tableId: data.tableId, socketId: socket.id }, 'Table deleted successfully');
          // Broadcast updated list to everyone
          this.io.emit(SocketEvents.SERVER.TABLE_LIST, this.getPublicTableList());
        }
      });

      // RF-01: Verify Tournament Owner PIN
      socket.on(SocketEvents.CLIENT.VERIFY_OWNER, (data: { pin: string }) => {
        if (!validateSocketPayload(socket, data, { pin: { required: true, type: 'string', pattern: /^\d{5,8}$/ } }, 'VERIFY_OWNER')) {
          return;
        }

        logger.info({ socketId: socket.id }, 'VERIFY_OWNER received');

        const validPin = this.ownerPin;

        if (data.pin === validPin) {
          // Mark socket as owner for future authorization
          (socket as any).data = { ...(socket as any).data, isOwner: true };
          socket.emit(SocketEvents.SERVER.OWNER_VERIFIED, { token: 'owner-session' });
          logger.info({ socketId: socket.id }, 'Owner verified successfully');
        } else {
          socket.emit(SocketEvents.SERVER.ERROR, { code: 'INVALID_OWNER_PIN', message: 'PIN de organizador incorrecto' });
          logger.warn({ socketId: socket.id }, 'Owner verification failed');
        }
      });

      // NEW: Get tables with PINs - Owner only
      socket.on(SocketEvents.CLIENT.GET_TABLES_WITH_PINS, (data?: { ownerPin?: string }) => {
        if (!validateSocketPayload(socket, data || {}, { ownerPin: { required: false, type: 'string', pattern: /^\d{5,8}$/ } }, 'GET_TABLES_WITH_PINS')) {
          return;
        }

        logger.debug({ socketId: socket.id }, 'GET_TABLES_WITH_PINS received');

        // Check if socket is marked as owner OR if valid owner PIN provided
        const isSocketOwner = (socket as any).data?.isOwner === true;
        const validOwnerPin = this.ownerPin;
        const isValidOwner = data?.ownerPin === validOwnerPin;

        if (!isSocketOwner && !isValidOwner) {
          logger.warn({ socketId: socket.id }, 'GET_TABLES_WITH_PINS rejected - not owner');
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'NOT_OWNER', message: 'No autorizado' });
        }

        logger.info({ socketId: socket.id }, 'Owner requested tables with pins');
        const tables = this.tableManager.getAllTablesWithPins();
        logger.debug({ socketId: socket.id, tableCount: tables.length }, 'Sending tables with PINs');
        socket.emit(SocketEvents.SERVER.TABLE_LIST_WITH_PINS, { tables });
      });

      // RF-04: Kill-Switch - Regenerate PIN and revoke previous referee
      socket.on(SocketEvents.CLIENT.REGENERATE_PIN, (data: { tableId: string; pin?: string }) => {
        if (!validateSocketPayload(socket, data, { tableId: { required: true, type: 'string', maxLength: 36 }, pin: { required: false, type: 'string', pattern: /^\d{4,8}$/ } }, 'REGENERATE_PIN')) {
          return;
        }

        if (!data?.tableId) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'INVALID_PARAMS', message: 'tableId required' });
        }

        const table = this.tableManager.getTable(data.tableId);
        if (!table) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'TABLE_NOT_FOUND', message: 'Mesa no encontrada' });
        }

        // Verify the requester is the owner (check valid owner PIN or empty pin from owner)
        const validOwnerPin = this.ownerPin;
        const isOwnerAuthorizing = !data.pin || data.pin === validOwnerPin;

        if (!isOwnerAuthorizing && table.pin !== data.pin) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'UNAUTHORIZED', message: 'No autorizado' });
        }

        // Get old referee before regenerating
        const oldRefereeSocketId = this.tableManager.getRefereeSocketId(data.tableId);

        // Regenerate PIN and reset everything (already handles status = WAITING)
        const newPin = this.tableManager.regeneratePin(data.tableId);
        if (!newPin) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'PIN_REGEN_FAILED', message: 'Error al regenerar PIN' });
        }

        // Emit REF_REVOKED to old referee if exists
        if (oldRefereeSocketId) {
          this.io.to(oldRefereeSocketId).emit(SocketEvents.SERVER.REF_REVOKED, {
            tableId: data.tableId,
            reason: 'Regenerado'
          });
          // Force disconnect from table room
          this.io.in(oldRefereeSocketId).socketsLeave(data.tableId);
          logger.info({ tableId: data.tableId, oldRefereeId: oldRefereeSocketId }, 'Old referee disconnected from table');
        }

        // Send new QR to the owner who requested regeneration
        const qrData = this.tableManager.generateQRData(data.tableId);
        if (qrData) {
          socket.emit(SocketEvents.SERVER.QR_DATA, qrData);
        }

        socket.emit(SocketEvents.SERVER.PIN_REGENERATED, { tableId: data.tableId, newPin });
        
        // Emit TABLE_UPDATE so Dashboard reflects the reset
        const tableInfo = this.tableManager.tableToInfo(table);
        this.io.emit(SocketEvents.SERVER.TABLE_UPDATE, this.toPublicTableInfo(tableInfo));
        
        logger.info({ tableId: data.tableId }, 'PIN regenerated for table');
      });

      // REF_ROLE_CHECK: Verify if socket is referee for a table
      socket.on(SocketEvents.CLIENT.REF_ROLE_CHECK, (data: { tableId: string }) => {
        if (!data?.tableId) {
          return socket.emit(SocketEvents.SERVER.ERROR, { code: 'INVALID_PARAMS', message: 'tableId required' });
        }

        const isReferee = this.tableManager.isReferee(data.tableId, socket.id);
        socket.emit(SocketEvents.SERVER.REF_ROLE_CHECK_RESULT, { tableId: data.tableId, isReferee });
      });

      // GET_RATE_LIMIT_STATUS: Return rate limit status for client's IP (debugging)
      socket.on(SocketEvents.CLIENT.GET_RATE_LIMIT_STATUS, () => {
        const clientIp = socket.handshake.address;
        const status = Array.from(this.rateLimitAttempts.entries())
          .filter(([key]) => key.includes(clientIp))
          .map(([key, timestamps]) => ({ key, attempts: timestamps.length }));
        socket.emit(SocketEvents.SERVER.RATE_LIMIT_STATUS, status);
      });

      socket.on('disconnect', () => {
        logger.info({ socketId: socket.id }, 'Socket disconnected');

        const allTables = this.tableManager.getAllTables();
        for (const table of allTables) {
          const t = this.tableManager.getTable(table.id);
          if (t?.players.some(p => p.socketId === socket.id)) {
            this.tableManager.leaveTable(table.id, socket.id);
          }
        }
      });
    });
  }
  
  public getTableInfo(tableId: string) {
    return this.tableManager.getAllTables().find(t => t.id === tableId);
  }

  private getPublicTableList(): Omit<TableInfo, 'pin'>[] {
    return this.tableManager.getAllTables().map((table) => this.toPublicTableInfo(table));
  }

  private toPublicTableInfo(table: TableInfo): Omit<TableInfo, 'pin'> {
    const { pin: _pin, ...publicTable } = table;
    return publicTable;
  }

  private isRateLimited(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.rateLimitWindowMs;
    const attempts = this.rateLimitAttempts.get(key) ?? [];
    const recentAttempts = attempts.filter((timestamp) => timestamp > windowStart);
    recentAttempts.push(now);
    this.rateLimitAttempts.set(key, recentAttempts);
    return recentAttempts.length > this.rateLimitMaxAttempts;
  }
}
