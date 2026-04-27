/**
 * RateLimiter - Rate limiting for socket events
 *
 * Responsibility: Track and limit request rates.
 * Includes automatic cleanup to prevent memory leaks.
 */

export class RateLimiter {
  private readonly windowMs: number;
  private readonly maxAttempts: number;
  private readonly cleanupIntervalMs: number;
  private attempts: Map<string, number[]> = new Map();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(windowMs: number = 60_000, maxAttempts: number = 5, cleanupIntervalMs: number = 60_000) {
    this.windowMs = windowMs;
    this.maxAttempts = maxAttempts;
    this.cleanupIntervalMs = cleanupIntervalMs;
  }

  /**
   * Start automatic cleanup of old entries.
   * Should be called once on server startup.
   */
  startCleanup(): void {
    if (this.cleanupTimer) return; // Already running
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.cleanupIntervalMs);
    // Unref so it doesn't prevent process exit
    this.cleanupTimer.unref();
  }

  /**
   * Stop automatic cleanup.
   */
  stopCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Remove entries older than 2x the window period.
   */
  private cleanup(): void {
    const cutoff = Date.now() - (2 * this.windowMs);
    for (const [key, timestamps] of this.attempts.entries()) {
      const recent = timestamps.filter(t => t > cutoff);
      if (recent.length === 0) {
        this.attempts.delete(key);
      } else {
        this.attempts.set(key, recent);
      }
    }
  }

  isRateLimited(key: string): boolean {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const attempts = this.attempts.get(key) ?? [];
    const recentAttempts = attempts.filter((timestamp) => timestamp > windowStart);
    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
    return recentAttempts.length > this.maxAttempts;
  }

  getAttempts(key: string): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const attempts = this.attempts.get(key) ?? [];
    return attempts.filter((timestamp) => timestamp > windowStart).length;
  }

  reset(): void {
    this.attempts.clear();
  }

  /**
   * Get all entries matching a client IP substring
   */
  getEntriesForIp(clientIp: string): { key: string; attempts: number }[] {
    return Array.from(this.attempts.entries())
      .filter(([key]) => key.includes(clientIp))
      .map(([key, timestamps]) => ({ key, attempts: timestamps.length }));
  }
}
