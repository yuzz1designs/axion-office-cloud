import { randomBytes } from "node:crypto";

export type DesktopAuthHandoffResult =
  | { ok: true; accessToken: string; refreshToken: string }
  | { ok: false; error: string };

interface Entry {
  expiresAt: number;
  result?: DesktopAuthHandoffResult;
}

export class DesktopAuthHandoffStore {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly ttlMs = 5 * 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  start() {
    this.prune();
    this.entries.clear();
    const state = randomBytes(32).toString("base64url");
    this.entries.set(state, { expiresAt: this.now() + this.ttlMs });
    return state;
  }

  pendingState() {
    this.prune();
    for (const [state, entry] of this.entries) {
      if (!entry.result) return state;
    }
    return null;
  }

  complete(state: string, result: DesktopAuthHandoffResult) {
    this.prune();
    const entry = this.entries.get(state);
    if (!entry || entry.result) return false;
    entry.result = result;
    return true;
  }

  consume(state: string): DesktopAuthHandoffResult | "pending" | null {
    this.prune();
    const entry = this.entries.get(state);
    if (!entry) return null;
    if (!entry.result) return "pending";
    this.entries.delete(state);
    return entry.result;
  }

  private prune() {
    const now = this.now();
    for (const [state, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(state);
    }
  }
}
