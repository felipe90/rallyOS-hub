import { MatchEngine, Player, MatchConfig, MatchStateExtended } from './matchEngine';
import { MatchEvent, Table, TableInfo, PlayerConnection, QRData } from './types';

export class TableManager {
  private tables: Map<string, Table> = new Map();
  private tableCounter: number = 0;
  private hubConfig: { ssid: string; ip: string; port: number };
  
  public onTableUpdate: (table: TableInfo) => void = () => {};
  public onMatchEvent: (tableId: string, event: MatchEvent) => void = () => {};
  
  constructor(hubConfig: { ssid: string; ip: string; port: number }) {
    this.hubConfig = hubConfig;
  }
  
  public createTable(name?: string): Table {
    this.tableCounter++;
    const id = this.generateId();
    const tableNumber = this.tableCounter;
    const tableName = name || `Mesa ${tableNumber}`;
    const pin = this.generatePin();
    
    const table: Table = {
      id,
      number: tableNumber,
      name: tableName,
      status: 'WAITING',
      pin,
      matchEngine: new MatchEngine(),
      playerNames: { a: 'Player A', b: 'Player B' },
      history: [],
      players: [],
      createdAt: Date.now()
    };
    
    table.matchEngine.setTableId(id, tableName);
    
    table.matchEngine.setEventCallback((event: MatchEvent) => {
      this.onMatchEvent(id, event);
    });
    
    this.tables.set(id, table);
    console.log(`[TableManager] Created ${tableName} (ID: ${id}, PIN: ${pin})`);
    
    this.notifyUpdate(table);
    
    return table;
  }
  
  public getTable(tableId: string): Table | undefined {
    return this.tables.get(tableId);
  }
  
  public getAllTables(): TableInfo[] {
    return Array.from(this.tables.values()).map(t => this.tableToInfo(t));
  }
  
  public joinTable(tableId: string, socketId: string, name: string): boolean {
    const table = this.tables.get(tableId);
    if (!table) return false;
    
    const existing = table.players.find(p => p.socketId === socketId);
    if (existing) {
      existing.name = name;
      this.notifyUpdate(table);
      return true;
    }
    
    const player: PlayerConnection = {
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
  
  public leaveTable(tableId: string, socketId: string): void {
    const table = this.tables.get(tableId);
    if (!table) return;
    
    const index = table.players.findIndex(p => p.socketId === socketId);
    if (index === -1) return;
    
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
  
  public setReferee(tableId: string, socketId: string, pin: string): boolean {
    const table = this.tables.get(tableId);
    if (!table || table.pin !== pin) return false;
    
    let player = table.players.find(p => p.socketId === socketId);
    
    if (player) {
      player.role = 'REFEREE';
    } else {
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
  
  public isReferee(tableId: string, socketId: string): boolean {
    const table = this.tables.get(tableId);
    if (!table) return false;
    
    const player = table.players.find(p => p.socketId === socketId);
    return player?.role === 'REFEREE';
  }
  
  public getPlayerRole(tableId: string, socketId: string): 'REFEREE' | 'SPECTATOR' {
    return this.isReferee(tableId, socketId) ? 'REFEREE' : 'SPECTATOR';
  }
  
  public configureMatch(tableId: string, config: { playerNames?: { a: string; b: string }; matchConfig?: MatchConfig }): void {
    const table = this.tables.get(tableId);
    if (!table) return;
    
    if (config.playerNames) {
      table.playerNames = config.playerNames;
      table.matchEngine.setPlayerNames(config.playerNames);
    }
    
    if (config.matchConfig) {
      // Create a fresh MatchEngine with the new config
      table.matchEngine = new MatchEngine(config.matchConfig);
      table.matchEngine.setTableId(table.id, table.name);
      table.matchEngine.setPlayerNames(table.playerNames);
      table.matchEngine.setEventCallback((event: MatchEvent) => {
        this.onMatchEvent(table.id, event);
      });
    }

    table.status = 'CONFIGURING';
    this.notifyUpdate(table);
  }
  
  public startMatch(tableId: string, config?: Partial<MatchConfig>): MatchStateExtended | null {
    console.log('[TableManager] startMatch called for table:', tableId, 'config:', config);
    
    const table = this.tables.get(tableId);
    if (!table) {
      console.warn('[TableManager] startMatch: table not found for tableId:', tableId);
      return null;
    }
    
    // If config provided, create a new MatchEngine with it
    if (config) {
      console.log('[TableManager] Creating new MatchEngine with config');
      // Preserve player names and table info
      const playerNames = table.playerNames;
      const tblId = table.id;
      const tblName = table.name;
      
      // Create new MatchEngine with the provided config
      table.matchEngine = new MatchEngine({
        pointsPerSet: config.pointsPerSet || 11,
        bestOf: config.bestOf || 3,
        minDifference: 2,
        handicapA: config.handicapA || 0,
        handicapB: config.handicapB || 0,
      });
      
      // Restore table metadata
      table.matchEngine.setTableId(tblId, tblName);
      table.matchEngine.setPlayerNames(playerNames);
      table.matchEngine.setEventCallback((event: MatchEvent) => {
        this.onMatchEvent(tableId, event);
      });
    }
    
    table.status = 'LIVE';
    const state = table.matchEngine.startMatch();
    console.log('[TableManager] After startMatch, state status:', state?.status);
    this.notifyUpdate(table);
    
    return state;
  }
  
  public recordPoint(tableId: string, player: Player): MatchStateExtended | null {
    const table = this.tables.get(tableId);
    if (!table || table.status !== 'LIVE') return null;
    
    const state = table.matchEngine.recordPoint(player);
    if (state) {
      // Sync table status with engine status (e.g. FINISHED after match won)
      table.status = state.status;
      this.notifyUpdate(table);
    }
    return state;
  }
  
  public subtractPoint(tableId: string, player: Player): MatchStateExtended | null {
    const table = this.tables.get(tableId);
    if (!table || table.status !== 'LIVE') return null;
    
    const state = table.matchEngine.subtractPoint(player);
    if (state) this.notifyUpdate(table);
    return state;
  }
  
  public undoLast(tableId: string): MatchStateExtended | null {
    const table = this.tables.get(tableId);
    if (!table || table.status !== 'LIVE') return null;
    
    const state = table.matchEngine.undoLast();
    if (state) this.notifyUpdate(table);
    return state;
  }
  
  public setServer(tableId: string, player: Player): MatchStateExtended | null {
    const table = this.tables.get(tableId);
    if (!table || table.status !== 'LIVE') return null;
    
    const state = table.matchEngine.setServer(player);
    if (state) this.notifyUpdate(table);
    return state;
  }
  
  public resetTable(tableId: string, config?: MatchConfig): MatchStateExtended | null {
    const table = this.tables.get(tableId);
    if (!table) return null;
    
    table.matchEngine = new MatchEngine(config);
    table.matchEngine.setTableId(table.id, table.name);
    table.matchEngine.setEventCallback((event: MatchEvent) => {
      this.onMatchEvent(table.id, event);
    });
    
    table.status = 'WAITING';
    this.notifyUpdate(table);
    
    return table.matchEngine.startMatch();
  }
  
  public getMatchState(tableId: string): MatchStateExtended | null {
    const table = this.tables.get(tableId);
    if (!table) return null;
    
    return table.matchEngine.getState();
  }
  
  public deleteTable(tableId: string): boolean {
    const deleted = this.tables.delete(tableId);
    if (deleted) {
      console.log(`[TableManager] Deleted table ${tableId}`);
    }
    return deleted;
  }
  
  public generateQRData(tableId: string): QRData | null {
    const table = this.tables.get(tableId);
    if (!table) return null;
    
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
  
  private generateId(): string {
    return crypto.randomUUID();
  }
  
  private generatePin(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }
  
  private notifyUpdate(table: Table): void {
    if (this.onTableUpdate) {
      this.onTableUpdate(this.tableToInfo(table));
    }
  }
  
  public tableToInfo(table: Table): TableInfo {
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
