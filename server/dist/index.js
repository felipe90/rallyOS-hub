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
app.use((0, cors_1.default)());
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
// Serve the React client (from dist or public)
const clientDistPath = path_1.default.join(__dirname, '../public/dist');
const clientPublicPath = path_1.default.join(__dirname, '../public');
const clientSrcPath = path_1.default.join(__dirname, '../../client');
const clientPath = fs_1.default.existsSync(clientDistPath) ? clientDistPath :
    fs_1.default.existsSync(clientPublicPath) ? clientPublicPath : clientSrcPath;
app.use(express_1.default.static(clientPath));
// Serve the Hub UI
app.get('/', (req, res) => {
    // Try: dist -> public -> client src
    const indexPath = fs_1.default.existsSync(path_1.default.join(clientDistPath, 'index.html'))
        ? path_1.default.join(clientDistPath, 'index.html')
        : fs_1.default.existsSync(path_1.default.join(clientPublicPath, 'index.html'))
            ? path_1.default.join(clientPublicPath, 'index.html')
            : path_1.default.join(clientSrcPath, 'index.html');
    res.sendFile(indexPath);
});
// API health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});
const httpServer = (0, https_1.createServer)(httpsOptions, app);
const io = new socket_io_1.Server(httpServer, {
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
const tableManager = new tableManager_1.TableManager(hubConfig);
new socketHandler_1.SocketHandler(io, tableManager);
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
