import { io } from 'socket.io-client';

const BASE = 'https://localhost:3000';
const ownerPin = '75406947';

const socket = io(BASE, { rejectUnauthorized: false, reconnectionAttempts: 0, transports: ['websocket'] });
const once = (ev, timeout = 5000) => new Promise((resolve, reject) => {
  const t = setTimeout(() => { socket.off(ev); reject(new Error(`timeout ${ev}`)); }, timeout);
  socket.once(ev, (d) => { clearTimeout(t); resolve(d); });
});
await new Promise((r, j) => { socket.on('connect', r); socket.on('connect_error', j); });
socket.emit('VERIFY_OWNER', { pin: ownerPin });
await once('OWNER_VERIFIED');

// Reset
socket.emit('BRACKET_RESET', { confirmToken: undefined });
const { token } = await once('BRACKET_RESET_CONFIRM');
socket.emit('BRACKET_RESET', { confirmToken: token });
await once('BRACKET_STATE');

// Create
socket.emit('BRACKET_CREATE', { name: 'Podium Demo', numSlots: 4, includeThirdPlace: true });
await once('BRACKET_STATE');

// Assign 4 players — wait for the state that has all 4 names
const allAssigned = new Promise((resolve) => {
  const h = (s) => {
    const ok = s?.matches?.find(m=>m.id==='R1-M1')?.playerA === 'Juan Pérez'
      && s?.matches?.find(m=>m.id==='R1-M1')?.playerB === 'María López'
      && s?.matches?.find(m=>m.id==='R1-M2')?.playerA === 'Carlos Ruiz'
      && s?.matches?.find(m=>m.id==='R1-M2')?.playerB === 'Ana Gómez';
    if (ok) { socket.off('BRACKET_STATE', h); resolve(); }
  };
  socket.on('BRACKET_STATE', h);
});
socket.emit('BRACKET_ASSIGN_PLAYER', { matchId: 'R1-M1', slot: 'A', name: 'Juan Pérez' });
socket.emit('BRACKET_ASSIGN_PLAYER', { matchId: 'R1-M1', slot: 'B', name: 'María López' });
socket.emit('BRACKET_ASSIGN_PLAYER', { matchId: 'R1-M2', slot: 'A', name: 'Carlos Ruiz' });
socket.emit('BRACKET_ASSIGN_PLAYER', { matchId: 'R1-M2', slot: 'B', name: 'Ana Gómez' });
await allAssigned;
console.log('players assigned');

// Set winners — wait for bracket COMPLETED
const done = new Promise((resolve) => {
  const h = (s) => {
    if (s?.status === 'COMPLETED' && s.thirdPlaceMatch?.status === 'COMPLETED') {
      socket.off('BRACKET_STATE', h);
      resolve(s);
    }
  };
  socket.on('BRACKET_STATE', h);
});
socket.emit('BRACKET_SET_WINNER', { matchId: 'R1-M1', winner: 'A' });
socket.emit('BRACKET_SET_WINNER', { matchId: 'R1-M2', winner: 'A' });
socket.emit('BRACKET_SET_WINNER', { matchId: 'R2-M1', winner: 'A' });
socket.emit('BRACKET_SET_WINNER', { matchId: 'TP-M1', winner: 'A' });
const final = await done;
const finalM = final.matches.find(m=>m.id==='R2-M1');
console.log('status:', final.status);
console.log('champion:', finalM.playerA, '| runner-up:', finalM.playerB);
console.log('third:', final.thirdPlaceMatch.playerA);

socket.close();
process.exit(0);
