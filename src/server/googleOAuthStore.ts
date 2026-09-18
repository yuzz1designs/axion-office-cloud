import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { OAuthGrant } from "./googleOAuthCore";

export class GoogleOAuthStore {
  private readonly filePath: string;

  constructor(private readonly directory = path.resolve(process.env.AXION_DATA_DIR || path.join(process.cwd(), ".axion-local"))) {
    this.filePath = path.join(directory, "google-oauth.json");
  }

  private readAll(): Record<string, OAuthGrant> {
    if (!existsSync(this.filePath)) return {};
    try {
      const value = JSON.parse(readFileSync(this.filePath, "utf8"));
      return value && typeof value === "object" ? value as Record<string, OAuthGrant> : {};
    } catch {
      throw new Error("GOOGLE_OAUTH_STORE_INVALID");
    }
  }

  read(profileId: string): OAuthGrant | null {
    const value = this.readAll()?.[profileId];
    if (!value) return null;
    if (!value.refreshToken || !value.email || !Array.isArray(value.scopes) || !value.connectedAt) throw new Error("GOOGLE_OAUTH_STORE_INVALID");
    return value;
  }

  private writeAll(value: Record<string, OAuthGrant>) {
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.filePath}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
    renameSync(temporaryPath, this.filePath);
    chmodSync(this.filePath, 0o600);
  }

  write(profileId: string, grant: OAuthGrant) {
    this.writeAll({ ...this.readAll(), [profileId]: grant });
  }

  clear(profileId: string) {
    if (!existsSync(this.filePath)) return;
    const all = this.readAll();
    delete all[profileId];
    if (!Object.keys(all).length) return unlinkSync(this.filePath);
    this.writeAll(all);
  }
}
