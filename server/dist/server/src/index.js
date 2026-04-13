"use strict";
/**
 * rallyOS-hub Entry Point
 *
 * Orchestrates app, server, and socket initialization.
 * This file only imports and wires modules together.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ownerPin = void 0;
const crypto_1 = __importDefault(require("crypto"));
const app_1 = require("./app");
const server_1 = require("./server");
const socket_1 = require("./socket");
const tableManager_1 = require("./tableManager");
const logger_1 = require("./utils/logger");
// Owner PIN initialization - mandatory with random fallback
const ownerPin = process.env.TOURNAMENT_OWNER_PIN || crypto_1.default.randomInt(10000000, 99999999).toString();
exports.ownerPin = ownerPin;
if (!process.env.TOURNAMENT_OWNER_PIN) {
    logger_1.logger.warn({ ownerPin }, 'TOURNAMENT_OWNER_PIN not set. Generated random owner PIN');
    logger_1.logger.warn('SAVE THIS PIN - it changes on every restart!');
}
// Create secure server
const { httpsServer, io } = (0, server_1.createSecureServer)(app_1.app);
const PORT = process.env.PORT || 3000;
const hubConfig = {
    ssid: process.env.HUB_SSID || 'RallyOS',
    ip: process.env.HUB_IP || '192.168.4.1',
    port: parseInt(process.env.PORT || '3000'),
    ownerPin,
};
// Create TableManager and SocketHandler
const tableManager = new tableManager_1.TableManager(hubConfig);
(0, socket_1.createSocketServer)(io, tableManager, ownerPin);
// Start listening
httpsServer.listen(PORT, () => {
    logger_1.logger.info({ port: PORT }, 'rallyOS-hub is live (SECURE)');
    logger_1.logger.info({ url: `https://localhost:${PORT}` }, 'Local URL');
    logger_1.logger.info({ url: `https://YOUR_IP:${PORT}` }, 'Network URL - Connect mobile phone to same WiFi');
});
// Graceful shutdown handlers
process.on('SIGTERM', () => (0, server_1.gracefulShutdown)(httpsServer, io, () => {
    const allTables = tableManager.getAllTables();
    for (const table of allTables) {
        tableManager.deleteTable(table.id);
    }
    logger_1.logger.info({ tableCount: allTables.length }, 'Active tables cleared');
}, 'SIGTERM'));
process.on('SIGINT', () => (0, server_1.gracefulShutdown)(httpsServer, io, () => {
    const allTables = tableManager.getAllTables();
    for (const table of allTables) {
        tableManager.deleteTable(table.id);
    }
    logger_1.logger.info({ tableCount: allTables.length }, 'Active tables cleared');
}, 'SIGINT'));
// Global error handling
process.on('uncaughtException', (error) => {
    logger_1.logger.error({ error, stack: error.stack }, 'Uncaught exception');
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.logger.error({ reason, promise }, 'Unhandled promise rejection');
});
