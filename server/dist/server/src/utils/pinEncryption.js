"use strict";
/**
 * PIN Encryption Utility
 *
 * Uses AES-256-GCM encryption for secure PIN transport.
 * Format output: {iv}:{ciphertext}:{authTag} (all hex encoded)
 * Key derivation: HMAC-SHA256(tableId, serverSecret)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptPin = encryptPin;
exports.decryptPin = decryptPin;
exports.encryptPinForUrl = encryptPinForUrl;
exports.decryptPinFromUrl = decryptPinFromUrl;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("./logger");
/**
 * Get or generate server secret from environment
 */
function getServerSecret() {
    const envSecret = process.env.ENCRYPTION_SECRET;
    if (envSecret) {
        return envSecret;
    }
    // Generate a random secret at startup if not provided
    if (!globalThis._RALLYOS_ENCRYPTION_SECRET) {
        globalThis._RALLYOS_ENCRYPTION_SECRET = crypto_1.default.randomBytes(32).toString('hex');
        logger_1.logger.warn('ENCRYPTION_SECRET not set, using random secret generated at startup');
    }
    return globalThis._RALLYOS_ENCRYPTION_SECRET;
}
/**
 * Derive encryption key from tableId and server secret using HMAC-SHA256
 */
function deriveKey(tableId) {
    const serverSecret = getServerSecret();
    return crypto_1.default.createHmac('sha256', serverSecret).update(tableId).digest();
}
/**
 * Encrypt a PIN
 * @param pin - 4 digit PIN
 * @param tableId - Table ID for key derivation
 * @returns Encrypted string in format {iv}:{ciphertext}:{authTag}
 */
function encryptPin(pin, tableId) {
    const key = deriveKey(tableId);
    const iv = crypto_1.default.randomBytes(16);
    const cipher = crypto_1.default.createCipheriv('aes-256-gcm', key, iv);
    let ciphertext = cipher.update(pin, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    const timestamp = Date.now().toString();
    return `${iv.toString('hex')}:${ciphertext}:${authTag.toString('hex')}:${timestamp}`;
}
/**
 * Decrypt a PIN from encrypted string
 * @param encryptedString - String in format {iv}:{ciphertext}:{authTag}:{timestamp}
 * @param tableId - Table ID for key derivation
 * @returns Original PIN or null if decryption fails
 */
function decryptPin(encryptedString, tableId) {
    try {
        const parts = encryptedString.split(':');
        if (parts.length !== 4) {
            logger_1.logger.error('Invalid PIN format - expected iv:ciphertext:authTag:timestamp');
            return null;
        }
        const [ivHex, ciphertext, authTagHex, timestamp] = parts;
        // Check if expired (24 hours)
        const age = Date.now() - parseInt(timestamp, 10);
        const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
        if (age > EXPIRY_MS) {
            logger_1.logger.warn('PIN expired');
            return null;
        }
        const key = deriveKey(tableId);
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        // Validate it's a 4-digit number
        if (!/^\d{4}$/.test(decrypted)) {
            logger_1.logger.error('Decrypted PIN invalid format');
            return null;
        }
        return decrypted;
    }
    catch (error) {
        logger_1.logger.error({ error }, 'Decryption failed');
        return null;
    }
}
/**
 * Encrypt PIN for URL query parameter
 * Uses Base64 encoding for URL safety
 */
function encryptPinForUrl(pin, tableId) {
    const encrypted = encryptPin(pin, tableId);
    // Base64 encode and make URL-safe
    return Buffer.from(encrypted).toString('base64url');
}
/**
 * Decrypt PIN from URL query parameter
 */
function decryptPinFromUrl(encryptedUrl, tableId) {
    try {
        // Decode from URL-safe Base64
        const decoded = Buffer.from(encryptedUrl, 'base64url').toString('utf8');
        return decryptPin(decoded, tableId);
    }
    catch (error) {
        logger_1.logger.error({ error }, 'URL decryption failed');
        return null;
    }
}
