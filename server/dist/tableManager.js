"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TableManager = void 0;
const matchEngine_1 = require("./matchEngine");
class TableManager {
    constructor(hubConfig) {
        this.tables = new Map();
        this.tableCounter = 0;
        this.onTableUpdate = () => { };
        this.onMatchEvent = () => { };
        this.hubConfig = hubConfig;
    }
    createTable(name) {
        this.tableCounter++;
        const id = this.generateId();
        const tableNumber = this.tableCounter;
        const tableName = name || `Mesa ${tableNumber}`;
        const pin = this.generatePin();
        const table = {
            id,
            number: tableNumber,
            name: tableName,
            status: 'WAITING',
            pin,
            matchEngine: new matchEngine_1.MatchEngine(),
            playerNames: { a: 'Player A', b: 'Player B' },
            history: [],
            players: [],
            createdAt: Date.now()
        };
        table.matchEngine.setTableId(id, tableName);
        table.matchEngine.setEventCallback((event) => {
            this.onMatchEvent(id, event);
        });
        this.tables.set(id, table);
        console.log(`[TableManager] Created ${tableName} (ID: ${id}, PIN: ${pin})`);
        this.notifyUpdate(table);
        return table;
    }
    getTable(tableId) {
        return this.tables.get(tableId);
    }
    getAllTables() {
        return Array.from(this.tables.values()).map(t => this.tableToInfo(t));
    }
    joinTable(tableId, socketId, name) {
        const table = this.tables.get(tableId);
        if (!table)
            return false;
        const existing = table.players.find(p => p.socketId === socketId);
        if (existing) {
            existing.name = name;
            this.notifyUpdate(table);
            return true;
        }
        const player = {
            socketId,
            name,
            role: 'SPECTATOR',
            joinedAt: Date.now()
        };
        table.players.push(player);
        this.notifyUpdate(table);
        console.log(`[TableManager] Player ${name} joined ${table.name}`);
        return true;
    }
    leaveTable(tableId, socketId) {
        const table = this.tables.get(tableId);
        if (!table)
            return;
        const index = table.players.findIndex(p => p.socketId === socketId);
        if (index === -1)
            return;
        const player = table.players[index];
        table.players.splice(index, 1);
        if (player.role === 'REFEREE') {
            const newRef = table.players.find(p => p.role !== 'REFEREE');
            if (newRef) {
                newRef.role = 'REFEREE';
            }
        }
        console.log(`[TableManager] Player ${player.name} left ${table.name}`);
        this.notifyUpdate(table);
    }
    setReferee(tableId, socketId, pin) {
        const table = this.tables.get(tableId);
        if (!table || table.pin !== pin)
            return false;
        let player = table.players.find(p => p.socketId === socketId);
        if (player) {
            player.role = 'REFEREE';
        }
        else {
            table.players.push({
                socketId,
                name: 'Referee',
                role: 'REFEREE',
                joinedAt: Date.now()
            });
        }
        console.log(`[TableManager] Referee authenticated for ${table.name}`);
        this.notifyUpdate(table);
        return true;
    }
    isReferee(tableId, socketId) {
        const table = this.tables.get(tableId);
        if (!table)
            return false;
        const player = table.players.find(p => p.socketId === socketId);
        return player?.role === 'REFEREE';
    }
    getPlayerRole(tableId, socketId) {
        return this.isReferee(tableId, socketId) ? 'REFEREE' : 'SPECTATOR';
    }
    configureMatch(tableId, config) {
        const table = this.tables.get(tableId);
        if (!table)
            return;
        if (config.playerNames) {
            table.playerNames = config.playerNames;
            table.matchEngine.setPlayerNames(config.playerNames);
        }
        if (config.matchConfig) {
            // Create a fresh MatchEngine with the new config
            table.matchEngine = new matchEngine_1.MatchEngine(config.matchConfig);
            table.matchEngine.setTableId(table.id, table.name);
            table.matchEngine.setPlayerNames(table.playerNames);
            table.matchEngine.setEventCallback((event) => {
                this.onMatchEvent(table.id, event);
            });
        }
        table.status = 'CONFIGURING';
        this.notifyUpdate(table);
    }
    startMatch(tableId, config) {
        const table = this.tables.get(tableId);
        if (!table)
            return null;
        // If config provided, create a new MatchEngine with it
        if (config) {
            // Preserve player names and table info
            const playerNames = table.playerNames;
            const tableId = table.id;
            const tableName = table.name;
            // Create new MatchEngine with the provided config
            table.matchEngine = new matchEngine_1.MatchEngine({
                pointsPerSet: config.pointsPerSet || 11,
                bestOf: config.bestOf || 3,
                minDifference: 2,
                handicapA: config.handicapA || 0,
                handicapB: config.handicapB || 0,
            });
            // Restore table metadata
            table.matchEngine.setTableId(tableId, tableName);
            table.matchEngine.setPlayerNames(playerNames);
            table.matchEngine.setEventCallback((event) => {
                this.onMatchEvent(tableId, event);
            });
        }
        table.status = 'LIVE';
        const state = table.matchEngine.startMatch();
        this.notifyUpdate(table);
        return state;
    }
    recordPoint(tableId, player) {
        const table = this.tables.get(tableId);
        if (!table || table.status !== 'LIVE')
            return null;
        const state = table.matchEngine.recordPoint(player);
        if (state) {
            // Sync table status with engine status (e.g. FINISHED after match won)
            table.status = state.status;
            this.notifyUpdate(table);
        }
        return state;
    }
    subtractPoint(tableId, player) {
        const table = this.tables.get(tableId);
        if (!table || table.status !== 'LIVE')
            return null;
        const state = table.matchEngine.subtractPoint(player);
        if (state)
            this.notifyUpdate(table);
        return state;
    }
    undoLast(tableId) {
        const table = this.tables.get(tableId);
        if (!table || table.status !== 'LIVE')
            return null;
        const state = table.matchEngine.undoLast();
        if (state)
            this.notifyUpdate(table);
        return state;
    }
    setServer(tableId, player) {
        const table = this.tables.get(tableId);
        if (!table || table.status !== 'LIVE')
            return null;
        const state = table.matchEngine.setServer(player);
        if (state)
            this.notifyUpdate(table);
        return state;
    }
    resetTable(tableId, config) {
        const table = this.tables.get(tableId);
        if (!table)
            return null;
        table.matchEngine = new matchEngine_1.MatchEngine(config);
        table.matchEngine.setTableId(table.id, table.name);
        table.matchEngine.setEventCallback((event) => {
            this.onMatchEvent(table.id, event);
        });
        table.status = 'WAITING';
        this.notifyUpdate(table);
        return table.matchEngine.startMatch();
    }
    getMatchState(tableId) {
        const table = this.tables.get(tableId);
        if (!table)
            return null;
        return table.matchEngine.getState();
    }
    deleteTable(tableId) {
        const deleted = this.tables.delete(tableId);
        if (deleted) {
            console.log(`[TableManager] Deleted table ${tableId}`);
        }
        return deleted;
    }
    generateQRData(tableId) {
        const table = this.tables.get(tableId);
        if (!table)
            return null;
        return {
            hubSsid: this.hubConfig.ssid,
            hubIp: this.hubConfig.ip,
            hubPort: this.hubConfig.port,
            tableId: table.id,
            tableName: table.name,
            pin: table.pin,
            url: `rallyhub://join/${table.id}?pin=${table.pin}`
        };
    }
    generateId() {
        return crypto.randomUUID();
    }
    generatePin() {
        return Math.floor(1000 + Math.random() * 9000).toString();
    }
    notifyUpdate(table) {
        if (this.onTableUpdate) {
            this.onTableUpdate(this.tableToInfo(table));
        }
    }
    tableToInfo(table) {
        const state = table.matchEngine.getState();
        return {
            id: table.id,
            number: table.number,
            name: table.name,
            // Use engine status as source of truth (handles FINISHED, LIVE, WAITING)
            status: state.status,
            pin: table.pin,
            playerCount: table.players.length,
            playerNames: state.playerNames,
            currentScore: state.score.currentSet,
            currentSets: state.score.sets,
            winner: state.winner
        };
    }
}
exports.TableManager = TableManager;
