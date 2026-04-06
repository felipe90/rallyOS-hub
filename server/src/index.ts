import express from 'express';
import { createServer } from 'https';
import { Server } from 'socket.io';
import cors from 'cors';
import { SocketHandler } from './socketHandler';
import path from 'path';
import fs from 'fs';

const app = express();
app.use(cors());

// Load SSL Certificates (generated via OpenSSL)
const httpsOptions = {
  key: fs.readFileSync(path.join(__dirname, '../key.pem')),
  cert: fs.readFileSync(path.join(__dirname, '../cert.pem'))
};

// Serve a very basic testing UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

const httpServer = createServer(httpsOptions, app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Initialize Socket Handler
new SocketHandler(io);

httpServer.listen(PORT, () => {
  console.log(`
  🚀 rallyOS-hub is live (SECURE)!
  -----------------------
  Local:   https://localhost:${PORT}
  Network: https://YOUR_IP:${PORT}
  -----------------------
  Connect your mobile phone to the same WiFi and visit the Network URL.
  (Remember to accept the self-signed certificate warning in your browser)
  `);
});
