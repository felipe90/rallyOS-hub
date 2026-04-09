"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const https_1 = require("https");
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const socketHandler_1 = require("./socketHandler");
const tableManager_1 = require("./tableManager");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const app = (0, express_1.default)();
const defaultAllowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://orangepi.local:3000',
];
const allowedOrigins = (process.env.HUB_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
const effectiveAllowedOrigins = allowedOrigins.length > 0 ? allowedOrigins : defaultAllowedOrigins;
const corsOriginValidator = (origin, callback) => {
    // Allow requests without Origin header (curl, local tools, server-to-server)
    if (!origin) {
        callback(null, true);
        return;
    }
    if (effectiveAllowedOrigins.includes(origin)) {
        callback(null, true);
        return;
    }
    callback(new Error('Not allowed by CORS'));
};
app.use((0, cors_1.default)({ origin: corsOriginValidator, credentials: true }));
// Path to SSL Certificates (must be generated via OpenSSL locally or via Docker)
const keyPath = path_1.default.join(__dirname, '../key.pem');
const certPath = path_1.default.join(__dirname, '../cert.pem');
if (!fs_1.default.existsSync(keyPath) || !fs_1.default.existsSync(certPath)) {
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
    key: fs_1.default.readFileSync(keyPath),
    cert: fs_1.default.readFileSync(certPath)
};
// Serve the React client (from dist, public, or client src)
// Priority: dist > public > src (for development)
const clientDistPath = path_1.default.join(__dirname, '../public/dist');
const clientPublicPath = path_1.default.join(__dirname, '../public');
const clientSrcPath = path_1.default.join(__dirname, '../../client');
let clientPath;
let indexPath;
// Determine which path to use based on what exists
if (fs_1.default.existsSync(clientDistPath)) {
    clientPath = clientDistPath;
    indexPath = path_1.default.join(clientDistPath, 'index.html');
    console.log('✓ Using built client (dist)');
}
else if (fs_1.default.existsSync(clientPublicPath) && fs_1.default.existsSync(path_1.default.join(clientPublicPath, 'index.html'))) {
    clientPath = clientPublicPath;
    indexPath = path_1.default.join(clientPublicPath, 'index.html');
    console.log('✓ Using public client');
}
else if (fs_1.default.existsSync(clientSrcPath)) {
    clientPath = clientSrcPath;
    indexPath = path_1.default.join(clientSrcPath, 'index.html');
    console.log('⚠️  Using client source (development mode)');
}
else {
    console.warn('⚠️  Client files not found in any expected location');
    clientPath = __dirname; // Fallback to app directory
    indexPath = path_1.default.join(__dirname, 'index.html');
}
app.use(express_1.default.static(clientPath));
// Serve the Hub UI
app.get('/', (req, res) => {
    if (fs_1.default.existsSync(indexPath)) {
        res.sendFile(indexPath);
    }
    else {
        res.status(404).send('Client not found. Build the client first.');
    }
});
// API health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});
const httpServer = (0, https_1.createServer)(httpsOptions, app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: corsOriginValidator,
        methods: ['GET', 'POST'],
        credentials: true,
    },
    transports: ['websocket', 'polling'], // Support both WebSocket and HTTP polling fallback
});
const PORT = process.env.PORT || 3000;
const hubConfig = {
    ssid: process.env.HUB_SSID || 'RallyOS',
    ip: process.env.HUB_IP || '192.168.4.1',
    port: parseInt(process.env.PORT || '3000')
};
// CRITICAL: Create TableManager first, then pass it to SocketHandler
const tableManager = new tableManager_1.TableManager(hubConfig);
new socketHandler_1.SocketHandler(io, tableManager);
// Log Socket.IO debug info
console.log('[🔌 Socket.IO] Initialized');
console.log('[🔌 Socket.IO] Transports:', io.engine.opts.transports);
console.log('[🔌 Socket.IO] Allowed CORS origins:', effectiveAllowedOrigins.join(', '));
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
