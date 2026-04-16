/**
 * PIN encryption utilities
 *
 * Provides XOR-based encryption/decryption for referee PINs in scoreboard URLs.
 * The key is derived from tableId + daily salt, making it unique per table per day.
 *
 * Encryption flow (used by QRCodeImage):
 *   pin → XOR with key → hex bytes (e.g., "1234" → "4f2a8c1b")
 *
 * Decryption flow (used by ScoreboardPage):
 *   URL ePin param → base64 decode → "hex:originalPin" → use hex portion
 *
 * Note: In the URL the encrypted PIN is base64-encoded as "hex:originalPin"
 * for integrity verification. The decryption here takes the hex portion only.
 */

const DAILY_SALT_HOUR = 0 // Midnight UTC for daily key rotation

/**
 * Generate a deterministic XOR key from tableId + daily salt.
 * Key is the same for all users on the same table on the same day.
 */
export function generateKey(tableId: string): string {
  const today = new Date()
  today.setUTCHours(DAILY_SALT_HOUR, 0, 0, 0)
  const dailySalt = today.getTime().toString()

  let hash = 0
  const combined = tableId + dailySalt
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i)
    // djb2-style hash
    hash = (hash << 5) - hash + char
    hash = hash & hash // 32-bit overflow
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * Encrypt a PIN using XOR with the generated key.
 * Returns raw hex bytes (e.g., "4f2a8c1b" for "1234").
 */
export function encryptPin(pin: string, key: string): string {
  let encrypted = ''

  for (let i = 0; i < pin.length; i++) {
    const charCode = pin.charCodeAt(i)
    const keyChar = key[i % key.length]
    const encryptedByte = charCode ^ keyChar.charCodeAt(0)
    encrypted += encryptedByte.toString(16).padStart(2, '0')
  }

  return encrypted
}

/**
 * Decrypt a hex-encoded encrypted PIN using XOR with the generated key.
 * Takes the raw hex string from the base64-decoded URL parameter.
 */
export function decryptPin(encrypted: string, key: string): string {
  let decrypted = ''

  for (let i = 0; i < encrypted.length; i += 2) {
    const hexByte = encrypted.substring(i, i + 2)
    const charCode = parseInt(hexByte, 16)
    const keyChar = key[(i / 2) % key.length]
    decrypted += String.fromCharCode(charCode ^ keyChar.charCodeAt(0))
  }

  return decrypted
}
