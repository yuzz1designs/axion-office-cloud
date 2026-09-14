import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { OAuthGrant } from "./googleOAuthCore";

export class GoogleOAuthStore {
  private readonly filePath: string;

  constructor(private readonly directory = path.resolve(process.cwd(), ".axion-local")) {
    this.filePath = path.join(directory, "google-oauth.json");
  }

  read(): OAuthGrant | null {
    if (!existsSync(this.filePath)) return null;
    try {
      const value = JSON.parse(readFileSync(this.filePath, "utf8")) as Partial<OAuthGrant>;
      if (!value.refreshToken || !value.email || !Array.isArray(value.scopes) || !value.connectedAt) throw new Error("INVALID_GRANT");
      return value as OAuthGrant;
    } catch {
      throw new Error("GOOGLE_OAUTH_STORE_INVALID");
    }
  }

  write(grant: OAuthGrant) {
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.filePath}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(grant, null, 2), { encoding: "utf8", mode: 0o600 });
    renameSync(temporaryPath, this.filePath);
    chmodSync(this.filePath, 0o600);
  }

  clear() {
    if (existsSync(this.filePath)) unlinkSync(this.filePath);
  }
}
