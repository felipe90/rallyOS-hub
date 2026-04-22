/**
 * RateLimiter - Rate limiting for socket events
 *
 * Responsibility: Track and limit request rates.
 */

export class RateLimiter {
  private readonly windowMs: number;
  private readonly maxAttempts: number;
  private attempts: Map<string, number[]> = new Map();

  constructor(windowMs: number = 60_000, maxAttempts: number = 5) {
    this.windowMs = windowMs;
    this.maxAttempts = maxAttempts;
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
