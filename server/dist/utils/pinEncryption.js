"use strict";
/**
 * PIN Encryption Utility
 *
 * Uses simple XOR cipher for LAN POC.
 * Format output: {encrypted}:{timestamp}
 * Key generation: tableId + daily salt (midnight timestamp)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptPin = encryptPin;
exports.decryptPin = decryptPin;
exports.encryptPinForUrl = encryptPinForUrl;
exports.decryptPinFromUrl = decryptPinFromUrl;
/**
 * Generate encryption key from tableId and daily salt
 */
function generateKey(tableId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dailySalt = today.getTime().toString();
    // Simple hash: tableId + salt
    let hash = 0;
    const combined = tableId + dailySalt;
    for (let i = 0; i < combined.length; i++) {
        const char = combined.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    // Convert to positive hex string for XOR
    return (hash >>> 0).toString(16).padStart(8, '0');
}
/**
 * XOR encrypt a string with a key
 */
function xorEncrypt(text, key) {
    let result = '';
    for (let i = 0; i < text.length; i++) {
        // Repeat key if shorter than text
        const keyChar = key[i % key.length];
        const textChar = text.charCodeAt(i);
        const keyCharCode = keyChar.charCodeAt(0);
        const encrypted = textChar ^ keyCharCode;
        result += String.fromCharCode(encrypted);
    }
    // Convert to hex for safe transport
    let hexResult = '';
    for (let i = 0; i < result.length; i++) {
        hexResult += result.charCodeAt(i).toString(16).padStart(2, '0');
    }
    return hexResult;
}
/**
 * XOR decrypt a hex string
 */
function xorDecrypt(hexText, key) {
    // Convert hex back to string
    let result = '';
    for (let i = 0; i < hexText.length; i += 2) {
        const hexByte = hexText.substr(i, 2);
        const charCode = parseInt(hexByte, 16);
        const keyChar = key[i / 2 % key.length];
        const decrypted = charCode ^ keyChar.charCodeAt(0);
        result += String.fromCharCode(decrypted);
    }
    return result;
}
/**
 * Encrypt a PIN for QR code
 * @param pin - 4 digit PIN
 * @param tableId - Table ID for key generation
 * @returns Encrypted string in format {encrypted}:{timestamp}
 */
function encryptPin(pin, tableId) {
    const key = generateKey(tableId);
    const encrypted = xorEncrypt(pin, key);
    const timestamp = Date.now().toString();
    return `${encrypted}:${timestamp}`;
}
/**
 * Decrypt a PIN from encrypted string
 * @param encryptedString - String in format {encrypted}:{timestamp}
 * @param tableId - Table ID for key generation
 * @returns Original PIN or null if decryption fails
 */
function decryptPin(encryptedString, tableId) {
    try {
        const parts = encryptedString.split(':');
        if (parts.length !== 2) {
            console.error('[PinEncryption] Invalid format - missing separator');
            return null;
        }
        const [encrypted, timestamp] = parts;
        // Optional: Check if expired (24 hours)
        const age = Date.now() - parseInt(timestamp);
        const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
        if (age > EXPIRY_MS) {
            console.warn('[PinEncryption] PIN expired');
            return null;
        }
        const key = generateKey(tableId);
        const decrypted = xorDecrypt(encrypted, key);
        // Validate it's a 4-digit number
        if (!/^\d{4}$/.test(decrypted)) {
            console.error('[PinEncryption] Decrypted PIN invalid format');
            return null;
        }
        return decrypted;
    }
    catch (error) {
        console.error('[PinEncryption] Decryption failed:', error);
        return null;
    }
}
/**
 * Encrypt PIN for URL query parameter
 * Uses same logic but URL-safe base64 encoding
 */
function encryptPinForUrl(pin, tableId) {
    const encrypted = encryptPin(pin, tableId);
    // Base64 encode for URL safety
    return btoa(encrypted);
}
/**
 * Decrypt PIN from URL query parameter
 */
function decryptPinFromUrl(encryptedUrl, tableId) {
    try {
        const decoded = atob(encryptedUrl);
        return decryptPin(decoded, tableId);
    }
    catch (error) {
        console.error('[PinEncryption] URL decryption failed:', error);
        return null;
    }
}
