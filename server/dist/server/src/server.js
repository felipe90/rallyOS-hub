"use strict";
/**
 * HTTPS Server Setup with Graceful Shutdown
 *
 * Creates secure HTTPS server and handles graceful shutdown.
 * Exports server instance and shutdown function.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSecureServer = createSecureServer;
exports.gracefulShutdown = gracefulShutdown;
const https_1 = require("https");
const socket_io_1 = require("socket.io");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logger_1 = require("./utils/logger");
function validateCertificates() {
    const keyPath = path_1.default.join(__dirname, '../key.pem');
    const certPath = path_1.default.join(__dirname, '../cert.pem');
    if (!fs_1.default.existsSync(keyPath) || !fs_1.default.existsSync(certPath)) {
        logger_1.logger.error(`
SSL Certificates not found!
To run rallyOS-hub, you need self-signed certificates.
RUN THIS COMMAND IN THE 'server' DIRECTORY:
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes -subj "/C=AR/ST=BA/L=City/O=RallyOS/OU=Dev/CN=localhost"
Then restart the server.
`);
        process.exit(1);
    }
    return {
        key: fs_1.default.readFileSync(keyPath),
        cert: fs_1.default.readFileSync(certPath),
    };
}
function createSecureServer(app) {
    const httpsOptions = validateCertificates();
    const httpsServer = (0, https_1.createServer)(httpsOptions, app);
    const io = new socket_io_1.Server(httpsServer, {
        cors: {
            origin: (origin, callback) => {
                if (!origin) {
                    callback(null, true);
                    return;
                }
                const allowedOrigins = (process.env.HUB_ALLOWED_ORIGINS || '')
                    .split(',')
                    .map((o) => o.trim())
                    .filter(Boolean);
                const effectiveAllowedOrigins = allowedOrigins.length > 0 ? allowedOrigins : [
                    'http://localhost:5173',
                    'https://localhost:5173',
                    'http://localhost:3000',
                    'https://localhost:3000',
                    'http://127.0.0.1:5173',
                    'https://127.0.0.1:5173',
                    'http://127.0.0.1:3000',
                    'https://127.0.0.1:3000',
                    'http://orangepi.local:3000',
                    'https://orangepi.local:3000',
                ];
                if (effectiveAllowedOrigins.includes(origin)) {
                    callback(null, true);
                    return;
                }
                logger_1.logger.warn({ origin }, 'Blocked origin');
                callback(null, false);
            },
            methods: ['GET', 'POST'],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
    });
    return { httpsServer, io };
}
async function gracefulShutdown(httpsServer, io, cleanupTables, signal = 'SIGTERM') {
    logger_1.logger.info({ signal }, 'Graceful shutdown initiated');
    // Close HTTP/HTTPS server
    await new Promise((resolve, reject) => {
        httpsServer.close((err) => {
            if (err) {
                logger_1.logger.error({ error: err }, 'Error during server close');
                reject(err);
            }
            else {
                resolve();
            }
        });
    });
    logger_1.logger.info('HTTP server closed');
    // Close Socket.IO connections
    await io.close();
    logger_1.logger.info('Socket.IO server closed');
    // Clear active tables
    if (cleanupTables) {
        cleanupTables();
    }
    logger_1.logger.info('Graceful shutdown complete');
}
