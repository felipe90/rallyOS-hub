"use strict";
/**
 * Socket.IO Server Setup
 *
 * Initializes Socket.IO server with event handlers.
 * Exports socket setup function.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSocketServer = createSocketServer;
const socketHandler_1 = require("./socketHandler");
const logger_1 = require("./utils/logger");
function createSocketServer(io, tableManager, ownerPin) {
    const socketHandler = new socketHandler_1.SocketHandler(io, tableManager, ownerPin);
    logger_1.logger.info('Socket.IO initialized');
    logger_1.logger.debug({ transports: io.engine.opts.transports }, 'Socket.IO transports');
    return socketHandler;
}
