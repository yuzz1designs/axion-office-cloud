import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";

const run = promisify(execFile);

export interface InstalledApplication {
  name: string;
  bundleId: string;
  path: string;
  icon?: string;
  installed: true;
  authorized: boolean;
  capabilities: string[];
  integrationMethods: string[];
}

async function plist(path: string, key: string) {
  return (await run("/usr/libexec/PlistBuddy", ["-c", `Print :${key}`, join(path, "Contents", "Info.plist")], { timeout: 3000, maxBuffer: 16000 })).stdout.trim();
}

export class AppRegistry {
  private readonly file: string;
  constructor(directory = process.cwd(), private readonly applicationDirectories = ["/Applications", "/System/Applications", "/System/Applications/Utilities", "/System/Library/CoreServices", join(homedir(), "Applications")]) { this.file = join(directory, "app-registry.json"); }

  private async readAuthorized() {
    try { const data = JSON.parse(await readFile(this.file, "utf8")); return new Set<string>(Array.isArray(data.authorizedBundleIds) ? data.authorizedBundleIds : []); }
    catch { return new Set<string>(); }
  }

  async list(): Promise<InstalledApplication[]> {
    const authorized = await this.readAuthorized();
    const paths = (await Promise.all(this.applicationDirectories.map(async directory => (await readdir(directory).catch(() => [])).filter(name => name.endsWith(".app")).map(name => join(directory, name))))).flat();
    const applications = await Promise.all(paths.map(async path => {
      try {
        const bundleId = await plist(path, "CFBundleIdentifier");
        if (!bundleId) return null;
        const displayName = await plist(path, "CFBundleDisplayName").catch(() => plist(path, "CFBundleName").catch(() => path.split("/").at(-1)!.replace(/\.app$/, "")));
        const iconName = await plist(path, "CFBundleIconFile").catch(() => "");
        const icon = iconName ? join(path, "Contents", "Resources", /\.[a-z0-9]+$/i.test(iconName) ? iconName : `${iconName}.icns`) : undefined;
        return { name: displayName, bundleId, path, icon, installed: true as const, authorized: authorized.has(bundleId), capabilities: ["launch", "accessibility", "computer_use"], integrationMethods: ["native_open", "apple_events", "accessibility", "computer_use"] };
      } catch { return null; }
    }));
    return (applications.filter(Boolean) as InstalledApplication[]).sort((a, b) => a.name.localeCompare(b.name));
  }

  async authorize(bundleId: string, value: boolean) {
    if (!/^[A-Za-z0-9.-]+$/.test(bundleId)) throw new Error("Bundle ID inválido.");
    const installed = await this.list();
    if (!installed.some(app => app.bundleId === bundleId)) throw new Error("Aplicação não instalada.");
    const authorized = await this.readAuthorized();
    value ? authorized.add(bundleId) : authorized.delete(bundleId);
    await mkdir(dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    await writeFile(temporary, JSON.stringify({ authorizedBundleIds: [...authorized].sort(), updatedAt: new Date().toISOString() }, null, 2), { mode: 0o600 });
    await rename(temporary, this.file);
    return this.list();
  }

  async isAuthorized(bundleId: string) { return (await this.readAuthorized()).has(bundleId); }
  async authorizedIds() { return this.readAuthorized(); }
}
