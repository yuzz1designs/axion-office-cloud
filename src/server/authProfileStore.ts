import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { UserProfile } from "./authCore";

export class AuthProfileStore {
  private readonly filePath: string;

  constructor(private readonly directory = path.resolve(process.env.AXION_DATA_DIR || path.join(process.cwd(), ".axion-local"))) {
    this.filePath = path.join(directory, "profiles.json");
  }

  readAll(): UserProfile[] {
    if (!existsSync(this.filePath)) return [];
    try {
      const value = JSON.parse(readFileSync(this.filePath, "utf8"));
      return Array.isArray(value) ? value as UserProfile[] : [];
    } catch {
      throw new Error("AXION_PROFILES_INVALID");
    }
  }

  findByEmail(email: string) {
    const normalizedEmail = email.trim().toLowerCase();
    return this.readAll().find((profile) => profile.email === normalizedEmail) ?? null;
  }

  findById(id: string) {
    return this.readAll().find((profile) => profile.id === id) ?? null;
  }

  upsert(profile: UserProfile) {
    const profiles = this.readAll().filter((item) => item.id !== profile.id && item.email !== profile.email);
    profiles.push(profile);
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const temporaryPath = `${this.filePath}.tmp`;
    writeFileSync(temporaryPath, JSON.stringify(profiles, null, 2), { encoding: "utf8", mode: 0o600 });
    renameSync(temporaryPath, this.filePath);
    chmodSync(this.filePath, 0o600);
  }
}
