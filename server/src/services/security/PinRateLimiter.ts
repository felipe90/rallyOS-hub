/**
 * PinRateLimiter — dedicated rate limiter for club PIN attempts
 *
 * Tracks failed PIN entry attempts per IP and applies a temporary block
 * when the threshold is exceeded. Prevents brute-force PIN guessing
 * against club court kiosks.
 */

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;
const BLOCK_DURATION_MS = 60_000;

export class PinRateLimiter {
  private attempts: Map<string, { count: number; blockedUntil: number }> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  private startCleanup(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.cleanup(), 60_000);
    this.cleanupTimer.unref();
  }

  /**
   * Remove stale entries (block expired or no activity in 2 windows).
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [ip, entry] of this.attempts.entries()) {
      if (entry.blockedUntil > 0 && now >= entry.blockedUntil) {
        this.attempts.delete(ip);
      }
    }
  }

  /**
   * Check if an IP is allowed to attempt PIN entry.
   * Returns whether the attempt is allowed and remaining block time if blocked.
   */
  check(ip: string): { allowed: boolean; remainingBlockSeconds?: number } {
    const entry = this.attempts.get(ip);
    if (!entry) return { allowed: true };

    const now = Date.now();

    // Currently blocked
    if (entry.blockedUntil > now) {
      const remaining = Math.ceil((entry.blockedUntil - now) / 1000);
      return { allowed: false, remainingBlockSeconds: remaining };
    }

    // Block expired — clean slate
    if (entry.blockedUntil > 0 && now >= entry.blockedUntil) {
      this.attempts.delete(ip);
      return { allowed: true };
    }

    // Under the limit — allowed
    if (entry.count < MAX_ATTEMPTS) {
      return { allowed: true };
    }

    // Exceeded limit — activate block
    entry.blockedUntil = now + BLOCK_DURATION_MS;
    const remaining = Math.ceil(BLOCK_DURATION_MS / 1000);
    return { allowed: false, remainingBlockSeconds: remaining };
  }

  /**
   * Record a failed attempt from an IP.
   */
  recordAttempt(ip: string): void {
    const entry = this.attempts.get(ip) ?? { count: 0, blockedUntil: 0 };
    entry.count++;
    this.attempts.set(ip, entry);
  }

  /**
   * Reset the rate limiter for a given IP (on successful join).
   */
  reset(ip: string): void {
    this.attempts.delete(ip);
  }
}
