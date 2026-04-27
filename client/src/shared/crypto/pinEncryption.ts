/**
 * PIN encryption utilities
 *
 * Uses AES-256-GCM encryption via Web Crypto API, compatible with
 * the server's pinEncryption.ts (Node.js crypto module).
 *
 * Key derivation: HMAC-SHA256(tableId, ENCRYPTION_SECRET) → 32-byte key
 * Encryption: AES-256-GCM with random 16-byte IV
 * Format: iv:ciphertext:authTag:timestamp (all hex, base64url-encoded for URL)
 *
 * The QR URL includes the encrypted PIN and the encryption secret:
 *   /scoreboard/{tableId}/referee?epin={encrypted}&secret={secret}
 */

/**
 * Derive a 32-byte AES key using HMAC-SHA256 via Web Crypto API.
 * Matches the server's deriveKey() function.
 */
async function deriveKey(tableId: string, secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    keyMaterial,
    encoder.encode(tableId),
  )
  // The HMAC signature is the 32-byte derived key
  return crypto.subtle.importKey(
    'raw',
    signature,
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  )
}

/**
 * Encrypt a PIN using AES-256-GCM.
 * Returns base64url-encoded string of iv:ciphertext:authTag:timestamp
 */
export async function encryptPin(pin: string, tableId: string, secret: string): Promise<string> {
  const key = await deriveKey(tableId, secret)
  const iv = crypto.getRandomValues(new Uint8Array(16))
  const encoder = new TextEncoder()

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(pin),
  )

  const ciphertextBytes = new Uint8Array(ciphertext)
  // Get auth tag (last 16 bytes of AES-GCM output in Web Crypto)
  const authTag = ciphertextBytes.slice(-16)
  const ciphertextBody = ciphertextBytes.slice(0, -16)

  const toHex = (bytes: Uint8Array) => Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  const timestamp = Date.now().toString()

  const formatted = `${toHex(iv)}:${toHex(ciphertextBody)}:${toHex(authTag)}:${timestamp}`
  return btoa(formatted).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

/**
 * Decrypt a PIN from a base64url-encoded encrypted string.
 * Returns the original 4-digit PIN or null if decryption fails.
 */
export async function decryptPin(encryptedUrl: string, tableId: string, secret: string): Promise<string | null> {
  try {
    // Decode from base64url
    const base64 = encryptedUrl.replace(/-/g, '+').replace(/_/g, '/')
    const decoded = atob(base64)
    const parts = decoded.split(':')

    if (parts.length !== 4) {
      return null
    }

    const [ivHex, ciphertextHex, authTagHex, timestamp] = parts

    // Check if expired (24 hours) — matches server behavior
    const age = Date.now() - parseInt(timestamp, 10)
    const EXPIRY_MS = 24 * 60 * 60 * 1000
    if (age > EXPIRY_MS) {
      return null
    }

    const fromHex = (hex: string) => {
      const bytes = new Uint8Array(hex.length / 2)
      for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
      }
      return bytes
    }

    const iv = fromHex(ivHex)
    const ciphertextBody = fromHex(ciphertextHex)
    const authTag = fromHex(authTagHex)

    // Web Crypto expects ciphertext + auth tag concatenated
    const combined = new Uint8Array(ciphertextBody.length + authTag.length)
    combined.set(ciphertextBody)
    combined.set(authTag, ciphertextBody.length)

    const key = await deriveKey(tableId, secret)

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      combined,
    )

    const decoder = new TextDecoder()
    const pin = decoder.decode(decrypted)

    // Validate it's a 4-digit number
    if (!/^\d{4}$/.test(pin)) {
      return null
    }

    return pin
  } catch {
    return null
  }
}

/**
 * Generate a deterministic XOR key (DEPRECATED — kept for backward compatibility).
 * @deprecated Use AES-256-GCM encryption instead
 */
export function generateKey(_tableId: string): string {
  // This function is deprecated. It returns a dummy value.
  // Remove after migration period.
  return '00000000'
}
