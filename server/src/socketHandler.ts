import { Server } from 'socket.io';
import { MatchEngine, Player, MatchState, MatchConfig } from './matchEngine';

export class SocketHandler {
  private io: Server;
  private matchEngine: MatchEngine;

  constructor(io: Server) {
    this.io = io;
    this.matchEngine = new MatchEngine();
    this.matchEngine.startMatch(); // Start a match by default for the POC
    this.setupListeners();
  }

  private setupListeners() {
    // 1. PIN Authentication Middleware
    const REFEREE_PIN = process.env.REFEREE_PIN;
    
    if (!REFEREE_PIN) {
      console.warn('⚠️  SECURITY WARNING: REFEREE_PIN is not set in environment variables. No one will be able to authenticate as Referee unless a PIN is provided.');
    }

    this.io.use((socket, next) => {
      const pin = socket.handshake.auth.pin;
      
      // If PIN is provided and matches, assign REFEREE role
      if (pin && pin === REFEREE_PIN) {
        (socket as any).role = 'REFEREE';
        console.log(`[Auth] Socket ${socket.id} authenticated as REFEREE`);
      } else {
        (socket as any).role = 'SPECTATOR';
        console.log(`[Auth] Socket ${socket.id} connected as SPECTATOR`);
      }
      next();
    });

    this.io.on('connection', (socket) => {
      console.log(`[Socket] New connection: ${socket.id} (Role: ${(socket as any).role})`);

      // 1. Send Initial State
      socket.emit('MATCH_UPDATE', this.matchEngine.getState());

      // 2. Point Recording (Referee action)
      socket.on('RECORD_POINT', (player: Player) => {
        if ((socket as any).role !== 'REFEREE') {
          return socket.emit('ERROR', 'Unauthorized: Invalid PIN');
        }
        
        console.log(`[Match] Point for: ${player}`);
        const newState = this.matchEngine.recordPoint(player);
        this.io.emit('MATCH_UPDATE', newState); // Broadcast to all
      });

      // 3. Point Subtraction (Referee action)
      socket.on('SUBTRACT_POINT', (player: Player) => {
        if ((socket as any).role !== 'REFEREE') {
          return socket.emit('ERROR', 'Unauthorized: Invalid PIN');
        }
        
        console.log(`[Match] Subtract point for: ${player}`);
        const newState = this.matchEngine.subtractPoint(player);
        this.io.emit('MATCH_UPDATE', newState);
      });

      // 4. Reset Match
      socket.on('RESET_MATCH', (config?: MatchConfig) => {
        if ((socket as any).role !== 'REFEREE') {
          return socket.emit('ERROR', 'Unauthorized: Invalid PIN');
        }

        console.log(`[Match] Resetting match state with config: ${JSON.stringify(config || 'DEFAULT')}`);
        this.matchEngine = new MatchEngine(config);
        this.matchEngine.startMatch();
        this.io.emit('MATCH_UPDATE', this.matchEngine.getState());
      });

      // 5. Set Server (Referee action)
      socket.on('SET_SERVER', (player: Player) => {
        if ((socket as any).role !== 'REFEREE') {
          return socket.emit('ERROR', 'Unauthorized: Invalid PIN');
        }
        
        console.log(`[Match] Manually set server to: ${player}`);
        const newState = this.matchEngine.setServer(player);
        this.io.emit('MATCH_UPDATE', newState);
      });

      // 6. Request Sync
      socket.on('SYNC_STATE', () => {
        socket.emit('MATCH_UPDATE', this.matchEngine.getState());
      });

      socket.on('disconnect', () => {
        console.log(`[Socket] Disconnected: ${socket.id}`);
      });
    });
  }
}
