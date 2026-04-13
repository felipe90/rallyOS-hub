"use strict";
/**
 * Express Application Setup
 *
 * Configures CORS, static file serving, routes, and middleware.
 * Exports the Express app instance.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = exports.effectiveAllowedOrigins = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const logger_1 = require("./utils/logger");
const app = (0, express_1.default)();
exports.app = app;
const defaultAllowedOrigins = [
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
const allowedOrigins = (process.env.HUB_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
exports.effectiveAllowedOrigins = allowedOrigins.length > 0 ? allowedOrigins : defaultAllowedOrigins;
const corsOriginValidator = (origin, callback) => {
    if (!origin) {
        callback(null, true);
        return;
    }
    if (exports.effectiveAllowedOrigins.includes(origin)) {
        callback(null, true);
        return;
    }
    logger_1.logger.warn({ origin }, 'Blocked origin');
    callback(null, false);
};
app.use((0, cors_1.default)({ origin: corsOriginValidator, credentials: true }));
// Serve the React client (from dist, public, or client src)
const clientDistPath = path_1.default.join(__dirname, '../public/dist');
const clientPublicPath = path_1.default.join(__dirname, '../public');
const clientSrcPath = path_1.default.join(__dirname, '../../client');
let clientPath;
let indexPath;
if (fs_1.default.existsSync(clientDistPath)) {
    clientPath = clientDistPath;
    indexPath = path_1.default.join(clientDistPath, 'index.html');
    logger_1.logger.info('Using built client (dist)');
}
else if (fs_1.default.existsSync(clientPublicPath) && fs_1.default.existsSync(path_1.default.join(clientPublicPath, 'index.html'))) {
    clientPath = clientPublicPath;
    indexPath = path_1.default.join(clientPublicPath, 'index.html');
    logger_1.logger.info('Using public client');
}
else if (fs_1.default.existsSync(clientSrcPath)) {
    clientPath = clientSrcPath;
    indexPath = path_1.default.join(clientSrcPath, 'index.html');
    logger_1.logger.warn('Using client source (development mode)');
}
else {
    logger_1.logger.warn('Client files not found in any expected location');
    clientPath = __dirname;
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
