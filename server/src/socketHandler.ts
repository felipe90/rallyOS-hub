import { Server, Socket } from 'socket.io';
import { TableManager } from './tableManager';
import { MatchEngine, Player, MatchConfig } from './matchEngine';

export class SocketHandler {
  private io: Server;
  private tableManager: TableManager;
  private hubConfig: { ssid: string; ip: string; port: number };

  constructor(io: Server, hubConfig: { ssid: string; ip: string; port: number }) {
    this.io = io;
    this.hubConfig = hubConfig;
    this.tableManager = new TableManager(hubConfig);
    
    this.tableManager.onTableUpdate = (tableInfo) => {
      this.io.emit('TABLE_UPDATE', tableInfo);
      this.io.emit('TABLE_LIST', this.tableManager.getAllTables());
    };
    
    this.tableManager.onMatchEvent = (tableId, event) => {
      if (event.type === 'SET_WON') {
        this.io.emit('SET_WON', { tableId, ...event });
      } else if (event.type === 'MATCH_WON') {
        this.io.emit('MATCH_WON', { tableId, ...event });
      }
    };
    
    this.setupSocketListeners();
  }
  
  private setupSocketListeners(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`[Socket] Connected: ${socket.id}`);
      
      socket.emit('TABLE_LIST', this.tableManager.getAllTables());
      
      socket.on('CREATE_TABLE', (data?: { name?: string }) => {
        const table = this.tableManager.createTable(data?.name);
        socket.emit('TABLE_CREATED', this.tableManager.tableToInfo(table));
        
        const qrData = this.tableManager.generateQRData(table.id);
        if (qrData) {
          socket.emit('QR_DATA', qrData);
        }
        
        socket.emit('MATCH_UPDATE', this.tableManager.getMatchState(table.id));
      });
      
      socket.on('LIST_TABLES', () => {
        socket.emit('TABLE_LIST', this.tableManager.getAllTables());
      });
      
      socket.on('JOIN_TABLE', (data: { tableId: string; name: string }) => {
        if (!data?.tableId || !data?.name) {
          return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId and name required' });
        }
        
        const success = this.tableManager.joinTable(data.tableId, socket.id, data.name);
        if (success) {
          socket.emit('TABLE_JOINED', { tableId: data.tableId });
          
          const tableInfo = this.tableManager.getAllTables().find(t => t.id === data.tableId);
          if (tableInfo) {
            socket.emit('TABLE_UPDATE', tableInfo);
          }
          
          const state = this.tableManager.getMatchState(data.tableId);
          if (state) {
            socket.emit('MATCH_UPDATE', state);
          }
        } else {
          socket.emit('ERROR', { code: 'TABLE_NOT_FOUND', message: 'Mesa no encontrada' });
        }
      });
      
      socket.on('LEAVE_TABLE', (data: { tableId: string }) => {
        if (!data?.tableId) return;
        
        const table = this.tableManager.getTable(data.tableId);
        if (!table) return;
        
        const player = table.players.find(p => p.socketId === socket.id);
        if (player) {
          this.tableManager.leaveTable(data.tableId, socket.id);
          socket.emit('PLAYER_LEFT', { tableId: data.tableId, socketId: socket.id });
        }
      });
      
      socket.on('SET_REF', (data: { tableId: string; pin: string }) => {
        if (!data?.tableId || !data?.pin) {
          return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId and pin required' });
        }
        
        const success = this.tableManager.setReferee(data.tableId, socket.id, data.pin);
        if (success) {
          socket.emit('REF_SET', { tableId: data.tableId });
          
          const tableInfo = this.tableManager.getAllTables().find(t => t.id === data.tableId);
          if (tableInfo) {
            this.io.emit('TABLE_UPDATE', tableInfo);
          }
        } else {
          socket.emit('ERROR', { code: 'INVALID_PIN', message: 'PIN incorrecto' });
        }
      });
      
      socket.on('CONFIGURE_MATCH', (data: { tableId: string; playerNames?: { a: string; b: string }; matchConfig?: MatchConfig }) => {
        if (!data?.tableId) {
          return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId required' });
        }
        
        if (!this.tableManager.isReferee(data.tableId, socket.id)) {
          return socket.emit('ERROR', { code: 'UNAUTHORIZED', message: 'No autorizado' });
        }
        
        this.tableManager.configureMatch(data.tableId, {
          playerNames: data.playerNames,
          matchConfig: data.matchConfig
        });
        
        const state = this.tableManager.getMatchState(data.tableId);
        if (state) {
          this.io.emit('MATCH_UPDATE', state);
        }
      });
      
      socket.on('START_MATCH', (data: { tableId: string }) => {
        if (!data?.tableId) {
          return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId required' });
        }
        
        if (!this.tableManager.isReferee(data.tableId, socket.id)) {
          return socket.emit('ERROR', { code: 'UNAUTHORIZED', message: 'No autorizado' });
        }
        
        const state = this.tableManager.startMatch(data.tableId);
        if (state) {
          this.io.emit('MATCH_UPDATE', state);
        }
      });
      
      socket.on('RECORD_POINT', (data: { tableId: string; player: Player }) => {
        if (!data?.tableId || !data?.player) {
          return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId and player required' });
        }
        
        if (!this.tableManager.isReferee(data.tableId, socket.id)) {
          return socket.emit('ERROR', { code: 'UNAUTHORIZED', message: 'No autorizado' });
        }
        
        const state = this.tableManager.recordPoint(data.tableId, data.player);
        if (state) {
          this.io.emit('MATCH_UPDATE', state);
        }
      });
      
      socket.on('SUBTRACT_POINT', (data: { tableId: string; player: Player }) => {
        if (!data?.tableId || !data?.player) {
          return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId and player required' });
        }
        
        if (!this.tableManager.isReferee(data.tableId, socket.id)) {
          return socket.emit('ERROR', { code: 'UNAUTHORIZED', message: 'No autorizado' });
        }
        
        const state = this.tableManager.subtractPoint(data.tableId, data.player);
        if (state) {
          this.io.emit('MATCH_UPDATE', state);
        }
      });
      
      socket.on('UNDO_LAST', (data: { tableId: string }) => {
        if (!data?.tableId) {
          return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId required' });
        }
        
        if (!this.tableManager.isReferee(data.tableId, socket.id)) {
          return socket.emit('ERROR', { code: 'UNAUTHORIZED', message: 'No autorizado' });
        }
        
        const state = this.tableManager.undoLast(data.tableId);
        if (state) {
          this.io.emit('MATCH_UPDATE', state);
        }
      });
      
      socket.on('SET_SERVER', (data: { tableId: string; player: Player }) => {
        if (!data?.tableId || !data?.player) {
          return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId and player required' });
        }
        
        if (!this.tableManager.isReferee(data.tableId, socket.id)) {
          return socket.emit('ERROR', { code: 'UNAUTHORIZED', message: 'No autorizado' });
        }
        
        const state = this.tableManager.setServer(data.tableId, data.player);
        if (state) {
          this.io.emit('MATCH_UPDATE', state);
        }
      });
      
      socket.on('RESET_TABLE', (data: { tableId: string; config?: MatchConfig }) => {
        if (!data?.tableId) {
          return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId required' });
        }
        
        if (!this.tableManager.isReferee(data.tableId, socket.id)) {
          return socket.emit('ERROR', { code: 'UNAUTHORIZED', message: 'No autorizado' });
        }
        
        const state = this.tableManager.resetTable(data.tableId, data.config);
        if (state) {
          this.io.emit('MATCH_UPDATE', state);
        }
      });
      
      socket.on('REQUEST_TABLE_STATE', (data: { tableId: string }) => {
        if (!data?.tableId) {
          return socket.emit('ERROR', { code: 'INVALID_PARAMS', message: 'tableId required' });
        }
        
        const state = this.tableManager.getMatchState(data.tableId);
        if (state) {
          socket.emit('MATCH_UPDATE', state);
        } else {
          socket.emit('ERROR', { code: 'TABLE_NOT_FOUND', message: 'Mesa no encontrada' });
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
  
  public getTableInfo(tableId: string) {
    return this.tableManager.getAllTables().find(t => t.id === tableId);
  }
}
