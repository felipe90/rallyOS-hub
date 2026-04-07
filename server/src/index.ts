import express from 'express';
import { createServer } from 'https';
import { Server } from 'socket.io';
import cors from 'cors';
import { SocketHandler } from './socketHandler';
import { TableManager } from './tableManager';
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

// Serve the React client (from dist, public, or client src)
// Priority: dist > public > src (for development)
const clientDistPath = path.join(__dirname, '../public/dist');
const clientPublicPath = path.join(__dirname, '../public');
const clientSrcPath = path.join(__dirname, '../../client');

let clientPath: string;
let indexPath: string;

// Determine which path to use based on what exists
if (fs.existsSync(clientDistPath)) {
  clientPath = clientDistPath;
  indexPath = path.join(clientDistPath, 'index.html');
  console.log('✓ Using built client (dist)');
} else if (fs.existsSync(clientPublicPath) && fs.existsSync(path.join(clientPublicPath, 'index.html'))) {
  clientPath = clientPublicPath;
  indexPath = path.join(clientPublicPath, 'index.html');
  console.log('✓ Using public client');
} else if (fs.existsSync(clientSrcPath)) {
  clientPath = clientSrcPath;
  indexPath = path.join(clientSrcPath, 'index.html');
  console.log('⚠️  Using client source (development mode)');
} else {
  console.warn('⚠️  Client files not found in any expected location');
  clientPath = __dirname; // Fallback to app directory
  indexPath = path.join(__dirname, 'index.html');
}

app.use(express.static(clientPath));

// Serve the Hub UI
app.get('/', (req, res) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Client not found. Build the client first.');
  }
});

// API health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

const httpServer = createServer(httpsOptions, app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

const hubConfig = {
  ssid: process.env.HUB_SSID || 'RallyOS',
  ip: process.env.HUB_IP || '192.168.4.1',
  port: parseInt(process.env.PORT || '3000')
};

// CRITICAL: Create TableManager first, then pass it to SocketHandler
const tableManager = new TableManager(hubConfig);
new SocketHandler(io, tableManager);

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
