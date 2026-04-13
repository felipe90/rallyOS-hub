"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateQRDataUrl = generateQRDataUrl;
exports.parseQRCode = parseQRCode;
const qrcode_1 = __importDefault(require("qrcode"));
async function generateQRDataUrl(data) {
    try {
        const dataString = JSON.stringify(data);
        const dataUrl = await qrcode_1.default.toDataURL(dataString, {
            width: 300,
            margin: 2,
            color: {
                dark: '#14B8A6',
                light: '#FFFFFF'
            },
            errorCorrectionLevel: 'M'
        });
        return dataUrl;
    }
    catch (error) {
        console.error('[QRGenerator] Error generating QR:', error);
        throw error;
    }
}
function parseQRCode(qrString) {
    try {
        const data = JSON.parse(qrString);
        if (data.tableId && data.pin) {
            return data;
        }
        return null;
    }
    catch {
        return null;
    }
}
