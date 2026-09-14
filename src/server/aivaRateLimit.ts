export class AivaRateLimiter {
  private readonly entries = new Map<string, { startedAt: number; count: number }>();
  constructor(private readonly windowMs = 60_000) {}

  consume(key: string, limit: number, now = Date.now()) {
    const current = this.entries.get(key);
    if (!current || now - current.startedAt >= this.windowMs) {
      this.entries.set(key, { startedAt: now, count: 1 });
      return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
  }
}
