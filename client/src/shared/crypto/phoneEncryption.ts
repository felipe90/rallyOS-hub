/**
 * phoneEncryption — client-side AES-256-GCM phone encryption via Web Crypto API.
 *
 * Wire format (matches server's phoneCipher.ts):
 *   `{nonceB64}:{ciphertextB64}:{authTagB64}`
 *   Three colon-separated base64 strings.
 *   AES-256-GCM: 12-byte nonce, 16-byte auth tag.
 *
 * The server never decrypts inside client flows; it only stores the ciphertext
 * and decrypts server-side on an explicit admin reveal request (phone-reveal).
 *
 * Pure function — no I/O, no module-level state.
 */

const KEY_BYTES = 32
const NONCE_BYTES = 12

/**
 * Encrypt a phone number using AES-256-GCM with the given base64 key.
 *
 * @param phone   The player's phone in plain text.
 * @param keyB64  Base64-encoded 32-byte AES-256 key (from ClubConfig.encryptionKey).
 * @returns       `{nonceB64}:{ciphertextB64}:{authTagB64}` — all base64.
 */
export async function encryptPhoneClient(phone: string, keyB64: string): Promise<string> {
  // Decode the base64 key to raw bytes
  const keyBytes = base64ToBytes(keyB64)

  // Import the key for AES-GCM usage
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    'AES-GCM',
    false,
    ['encrypt'],
  )

  // Generate a fresh 12-byte nonce
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES))

  // Encrypt the phone bytes
  const encoder = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    encoder.encode(phone),
  )

  // Web Crypto concatenates ciphertext + auth tag (last 16 bytes is the tag)
  const combined = new Uint8Array(ciphertext)
  const authTag = combined.slice(-16)
  const ciphertextBody = combined.slice(0, -16)

  // Encode each part as base64
  const nonceB64 = bytesToBase64(nonce)
  const bodyB64 = bytesToBase64(ciphertextBody)
  const tagB64 = bytesToBase64(authTag)

  return `${nonceB64}:${bodyB64}:${tagB64}`
}

/** Decode a base64 string to a Uint8Array. */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/** Encode a Uint8Array to base64 string. */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
