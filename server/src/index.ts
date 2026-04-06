import express from 'express';
import { createServer } from 'https';
import { Server } from 'socket.io';
import cors from 'cors';
import { SocketHandler } from './socketHandler';
import path from 'path';
import fs from 'fs';

const app = express();
app.use(cors());

// Path to SSL Certificates (must be generated via OpenSSL locally or via Docker)
const keyPath = path.join(__dirname, '../key.pem');
const certPath = path.join(__dirname, '../cert.pem');

if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
  console.error(`
  ❌ ERROR: SSL Certificates not found!
  --------------------------------------------------
  To run rallyOS-hub, you need self-signed certificates.
  RUN THIS COMMAND IN THE 'server' DIRECTORY:
  
  openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=AR/ST=BA/L=City/O=RallyOS/OU=Dev/CN=localhost"
  
  Then restart the server.
  --------------------------------------------------
  `);
  process.exit(1);
}

const httpsOptions = {
  key: fs.readFileSync(keyPath),
  cert: fs.readFileSync(certPath)
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
