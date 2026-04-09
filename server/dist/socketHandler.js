"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SocketHandler = void 0;
class SocketHandler {
    constructor(io, tableManager) {
        this.rateLimitWindowMs = 60000;
        this.rateLimitMaxAttempts = 5;
        this.rateLimitAttempts = new Map();
        this.io = io;
        this.tableManager = tableManager;
        // Set up global table update listener once
        this.tableManager.onTableUpdate = (tableInfo) => {
            this.io.emit('TABLE_UPDATE', this.toPublicTableInfo(tableInfo));
            this.io.emit('TABLE_LIST', this.getPublicTableList());
        };
        this.tableManager.onMatchEvent = (tableId, event) => {
            // Emit events only to the specific table room
            if (event.type === 'SET_WON') {
                this.io.to(tableId).emit('SET_WON', { tableId, ...event });
            }
            else if (event.type === 'MATCH_WON') {
                this.io.to(tableId).emit('MATCH_WON', { tableId, ...event });
            }
        };
        this.setupListeners();
    }
    setupListeners() {
        this.io.on('connection', (socket) => {
            console.log(`[✓ Socket] Client connected: ${socket.id}`);
            console.log(`[Socket] Connected clients: ${this.io.engine.clientsCount}`);
            // Send current tables to new client
            socket.emit('TABLE_LIST', this.getPublicTableList());
            // Handle disconnection
            socket.on('disconnect', (reason) => {
                console.log(`[✗ Socket] Client disconnected: ${socket.id} - Reason: ${reason}`);
                console.log(`[Socket] Connected clients: ${this.io.engine.clientsCount}`);
            });
            // Handle errors
            socket.on('error', (error) => {
                console.error(`[✗ Socket Error] ${socket.id}:`, error);
            });
            socket.on('CREATE_TABLE', (data) => {
                const table = this.tableManager.createTable(data?.name);
                socket.join(table.id); // Creator joins the table room
                // POC UX: the table creator is trusted as initial referee for that table.
                // This avoids relying on exposing/storing table PIN on the client.
                this.tableManager.joinTable(table.id, socket.id, 'Referee');
                this.tableManager.setReferee(table.id, socket.id, table.pin);
                socket.emit('TABLE_CREATED', this.tableManager.tableToInfo(table));
                socket.emit('REF_SET', { tableId: table.id });
                const qrData = this.tableManager.generateQRData(table.id);
                if (qrData) {
                    socket.emit('QR_DATA', qrData);
                }
                socket.emit('MATCH_UPDATE', this.tableManager.getMatchState(table.id));
            });
            socket.on('LIST_TABLES', () => {
                socket.emit('TABLE_LIST', this.getPublicTableList());
            });
            socket.on('GET_MATCH_STATE', (data) => {
                if (!data?.tableId) {
                    return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId required' });
                }
                const state = this.tableManager.getMatchState(data.tableId);
                if (state) {
                    socket.emit('MATCH_UPDATE', state);
                }
                else {
                    socket.emit('ERROR', { code: 'TABLE_NOT_FOUND', message: 'Partido no encontrado' });
                }
            });
            socket.on('JOIN_TABLE', (data) => {
                if (!data?.tableId) {
                    return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId required' });
                }
                const playerName = data.name || `Espectador ${socket.id.slice(0, 6)}`;
                const success = this.tableManager.joinTable(data.tableId, socket.id, playerName, data.pin);
                if (success) {
                    socket.join(data.tableId); // JOIN the socket room for this table
                    socket.emit('TABLE_JOINED', { tableId: data.tableId });
                    const tableInfo = this.tableManager.getAllTables().find(t => t.id === data.tableId);
                    if (tableInfo) {
                        socket.emit('TABLE_UPDATE', this.toPublicTableInfo(tableInfo));
                    }
                    const state = this.tableManager.getMatchState(data.tableId);
                    if (state) {
                        socket.emit('MATCH_UPDATE', state);
                    }
                }
                else {
                    // Check if it's a PIN error
                    const table = this.tableManager.getAllTables().find(t => t.id === data.tableId);
                    if (table && data.pin) {
                        socket.emit('ERROR', { code: 'INVALID_PIN', message: 'PIN incorrecto' });
                    }
                    else {
                        socket.emit('ERROR', { code: 'TABLE_NOT_FOUND', message: 'Mesa no encontrada' });
                    }
                }
            });
            socket.on('LEAVE_TABLE', (data) => {
                if (!data?.tableId)
                    return;
                socket.leave(data.tableId); // LEAVE the socket room
                const table = this.tableManager.getTable(data.tableId);
                if (!table)
                    return;
                const player = table.players.find(p => p.socketId === socket.id);
                if (player) {
                    this.tableManager.leaveTable(data.tableId, socket.id);
                    this.io.to(data.tableId).emit('PLAYER_LEFT', { tableId: data.tableId, socketId: socket.id });
                }
            });
            socket.on('SET_REF', (data) => {
                if (!data?.tableId || !data?.pin) {
                    return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId and pin required' });
                }
                const rateLimitKey = `SET_REF:${data.tableId}:${socket.id}`;
                if (this.isRateLimited(rateLimitKey)) {
                    return socket.emit('ERROR', {
                        code: 'RATE_LIMITED',
                        message: 'Too many attempts. Please wait a minute before trying again.',
                    });
                }
                const success = this.tableManager.setReferee(data.tableId, socket.id, data.pin);
                if (success) {
                    socket.join(data.tableId); // Ensure referee is in the room
                    socket.emit('REF_SET', { tableId: data.tableId });
                    const tableInfo = this.tableManager.getAllTables().find(t => t.id === data.tableId);
                    if (tableInfo) {
                        this.io.emit('TABLE_UPDATE', this.toPublicTableInfo(tableInfo)); // Update global dashboard
                    }
                }
                else {
                    socket.emit('ERROR', { code: 'INVALID_PIN', message: 'PIN incorrecto' });
                }
            });
            socket.on('CONFIGURE_MATCH', (data) => {
                if (!data?.tableId) {
                    return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId required' });
                }
                if (!this.tableManager.isReferee(data.tableId, socket.id)) {
                    return socket.emit('ERROR', { code: 'UNAUTHORIZED', message: 'No autorizado' });
                }
                // Map UI data to MatchConfig
                const matchConfig = {};
                if (data.format)
                    matchConfig.bestOf = data.format;
                if (data.ptsPerSet)
                    matchConfig.pointsPerSet = data.ptsPerSet;
                if (data.handicap) {
                    matchConfig.initialScore = { a: data.handicap.a, b: data.handicap.b };
                }
                this.tableManager.configureMatch(data.tableId, {
                    playerNames: data.playerNames,
                    matchConfig: matchConfig
                });
                const state = this.tableManager.getMatchState(data.tableId);
                if (state) {
                    this.io.to(data.tableId).emit('MATCH_UPDATE', state); // Emit only to room
                }
            });
            socket.on('START_MATCH', (data) => {
                console.log('[SocketHandler] START_MATCH received:', data);
                if (!data?.tableId) {
                    console.warn('[SocketHandler] START_MATCH: tableId missing');
                    return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId required' });
                }
                if (!this.tableManager.isReferee(data.tableId, socket.id)) {
                    console.warn('[SocketHandler] START_MATCH: Not a referee for table', data.tableId);
                    return socket.emit('ERROR', { code: 'UNAUTHORIZED', message: 'No autorizado' });
                }
                console.log('[SocketHandler] START_MATCH: Calling tableManager.startMatch with config:', {
                    pointsPerSet: data.pointsPerSet || 11,
                    bestOf: data.bestOf || 3,
                    handicapA: data.handicapA || 0,
                    handicapB: data.handicapB || 0,
                    playerNameA: data.playerNameA || 'Player A',
                    playerNameB: data.playerNameB || 'Player B',
                });
                const state = this.tableManager.startMatch(data.tableId, {
                    pointsPerSet: data.pointsPerSet || 11,
                    bestOf: data.bestOf || 3,
                    handicapA: data.handicapA || 0,
                    handicapB: data.handicapB || 0,
                    playerNameA: data.playerNameA,
                    playerNameB: data.playerNameB,
                });
                console.log('[SocketHandler] START_MATCH: Result state:', state);
                if (state) {
                    console.log('[SocketHandler] START_MATCH: Emitting MATCH_UPDATE to room', data.tableId);
                    this.io.to(data.tableId).emit('MATCH_UPDATE', state); // Emit only to room
                }
                else {
                    console.warn('[SocketHandler] START_MATCH: tableManager.startMatch returned null');
                }
            });
            socket.on('RECORD_POINT', (data) => {
                if (!data?.tableId || !data?.player) {
                    return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId and player required' });
                }
                if (!this.tableManager.isReferee(data.tableId, socket.id)) {
                    return socket.emit('ERROR', { code: 'UNAUTHORIZED', message: 'No autorizado' });
                }
                const state = this.tableManager.recordPoint(data.tableId, data.player);
                if (state) {
                    this.io.to(data.tableId).emit('MATCH_UPDATE', state); // Emit only to room
                }
            });
            socket.on('SUBTRACT_POINT', (data) => {
                if (!data?.tableId || !data?.player) {
                    return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId and player required' });
                }
                if (!this.tableManager.isReferee(data.tableId, socket.id)) {
                    return socket.emit('ERROR', { code: 'UNAUTHORIZED', message: 'No autorizado' });
                }
                const state = this.tableManager.subtractPoint(data.tableId, data.player);
                if (state) {
                    this.io.to(data.tableId).emit('MATCH_UPDATE', state); // Emit only to room
                }
            });
            socket.on('UNDO_LAST', (data) => {
                if (!data?.tableId) {
                    return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId required' });
                }
                if (!this.tableManager.isReferee(data.tableId, socket.id)) {
                    return socket.emit('ERROR', { code: 'UNAUTHORIZED', message: 'No autorizado' });
                }
                const state = this.tableManager.undoLast(data.tableId);
                if (state) {
                    this.io.to(data.tableId).emit('MATCH_UPDATE', state); // Emit only to room
                }
            });
            socket.on('SET_SERVER', (data) => {
                if (!data?.tableId || !data?.player) {
                    return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId and player required' });
                }
                if (!this.tableManager.isReferee(data.tableId, socket.id)) {
                    return socket.emit('ERROR', { code: 'UNAUTHORIZED', message: 'No autorizado' });
                }
                const state = this.tableManager.setServer(data.tableId, data.player);
                if (state) {
                    this.io.to(data.tableId).emit('MATCH_UPDATE', state); // Emit only to room
                }
            });
            socket.on('RESET_TABLE', (data) => {
                if (!data?.tableId) {
                    return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId required' });
                }
                if (!this.tableManager.isReferee(data.tableId, socket.id)) {
                    return socket.emit('ERROR', { code: 'UNAUTHORIZED', message: 'No autorizado' });
                }
                const state = this.tableManager.resetTable(data.tableId, data.config);
                if (state) {
                    this.io.to(data.tableId).emit('MATCH_UPDATE', state); // Emit only to room
                }
            });
            socket.on('REQUEST_TABLE_STATE', (data) => {
                if (!data?.tableId) {
                    return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId required' });
                }
                const state = this.tableManager.getMatchState(data.tableId);
                if (state) {
                    socket.emit('MATCH_UPDATE', state);
                }
                else {
                    socket.emit('ERROR', { code: 'TABLE_NOT_FOUND', message: 'Mesa no encontrada' });
                }
            });
            socket.on('DELETE_TABLE', (data) => {
                if (!data?.tableId || !data?.pin) {
                    return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId and pin required' });
                }
                const rateLimitKey = `DELETE_TABLE:${data.tableId}:${socket.id}`;
                if (this.isRateLimited(rateLimitKey)) {
                    return socket.emit('ERROR', {
                        code: 'RATE_LIMITED',
                        message: 'Too many attempts. Please wait a minute before trying again.',
                    });
                }
                const table = this.tableManager.getTable(data.tableId);
                if (!table) {
                    return socket.emit('ERROR', { code: 'TABLE_NOT_FOUND', message: 'Mesa no encontrada' });
                }
                if (table.pin !== data.pin) {
                    return socket.emit('ERROR', { code: 'INVALID_PIN', message: 'PIN incorrecto' });
                }
                // Notify room members that the table is gone
                this.io.to(data.tableId).emit('TABLE_DELETED', { tableId: data.tableId });
                // Force everyone out of the socket room
                this.io.in(data.tableId).socketsLeave(data.tableId);
                // Delete from manager
                const success = this.tableManager.deleteTable(data.tableId);
                if (success) {
                    console.log(`[Socket] Table ${data.tableId} killed by ${socket.id}`);
                    // Broadcast updated list to everyone
                    this.io.emit('TABLE_LIST', this.getPublicTableList());
                }
            });
            socket.on('disconnect', () => {
                console.log(`[Socket] Disconnected: ${socket.id}`);
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
    getTableInfo(tableId) {
        return this.tableManager.getAllTables().find(t => t.id === tableId);
    }
    getPublicTableList() {
        return this.tableManager.getAllTables().map((table) => this.toPublicTableInfo(table));
    }
    toPublicTableInfo(table) {
        const { pin: _pin, ...publicTable } = table;
        return publicTable;
    }
    isRateLimited(key) {
        const now = Date.now();
        const windowStart = now - this.rateLimitWindowMs;
        const attempts = this.rateLimitAttempts.get(key) ?? [];
        const recentAttempts = attempts.filter((timestamp) => timestamp > windowStart);
        recentAttempts.push(now);
        this.rateLimitAttempts.set(key, recentAttempts);
        return recentAttempts.length > this.rateLimitMaxAttempts;
    }
}
exports.SocketHandler = SocketHandler;
