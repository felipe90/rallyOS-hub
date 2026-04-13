"use strict";
/**
 * Structured Logger with Pino
 *
 * Provides JSON-structured logging with levels (info/warn/error)
 * ISO timestamps, and contextual metadata (tableId, socketId, ip)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.createChildLogger = createChildLogger;
const pino_1 = __importDefault(require("pino"));
const isDevelopment = process.env.NODE_ENV !== 'production';
exports.logger = (0, pino_1.default)({
    level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
    transport: isDevelopment
        ? {
            target: 'pino-pretty',
            options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
            },
        }
        : undefined,
    redact: {
        paths: ['pin', 'ownerPin', 'encryptedPin', 'password', 'secret', 'token'],
        censor: '[REDACTED]',
    },
    timestamp: pino_1.default.stdTimeFunctions.isoTime,
});
/**
 * Create a child logger with contextual metadata
 */
function createChildLogger(context) {
    return exports.logger.child(context);
}
