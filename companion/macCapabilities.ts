import { execFile } from "node:child_process";
import { promisify } from "node:util";
import * as os from "node:os";
import * as fs from "node:fs/promises";
import path from "node:path";
import { constants } from "node:fs";
import { isMacTool, MAC_TOOLS } from "../src/lib/aivaCapabilities";
import { COMPUTER_VISION_TOOLS } from "../src/lib/aivaCapabilities";
import { nativeCommand, nativeStatus } from "./native";
import { organizeDirectory } from "./fileOrganization";

const run = promisify(execFile);
const command = async (file: string, args: string[]) => (await run(file, args, { timeout: 8000, maxBuffer: 128000, shell: false })).stdout.trim();
const script = (source: string, args: string[] = []) => command("/usr/bin/osascript", ["-e", source, ...args]);
const text = (value: unknown, limit = 16000) => {
  if (typeof value !== "string" || !value.trim() || value.length > limit || value.includes("\0")) throw new Error("Argumento de texto inválido.");
  return value;
};
const safeDocument = (value: string) => /\.(pdf|txt|md|csv|json|png|jpe?g|webp|docx|xlsx|pptx)$/i.test(value);

export async function permittedPath(value: string, roots: string[], creating = false, allowRoot = false) {
  if (!path.isAbsolute(value)) throw new Error("Usa um caminho absoluto dentro de uma pasta autorizada.");
  const candidate = creating ? path.join(await fs.realpath(path.dirname(value)), path.basename(value)) : await fs.realpath(value);
  const resolvedRoots = await Promise.all(roots.map(root => fs.realpath(root)));
  if (!resolvedRoots.some(root => candidate.startsWith(root + path.sep) || (allowRoot && root === candidate))) throw new Error("Ficheiro fora das pastas autorizadas.");
  return candidate;
}

export async function discoverMacCapabilities(roots: string[]) {
  if (process.platform !== "darwin") return [];
  const capabilities = Object.keys(MAC_TOOLS).filter(name => !/file|directory/.test(name) || roots.length > 0);
  const native = await nativeStatus();
  const available = capabilities.filter(name => !COMPUTER_VISION_TOOLS.has(name) || (name === "computer_screenshot" ? native.screenRecording : native.accessibility));
  try { await script("get volume settings"); } catch { return available.filter(name => !/volume|muted/.test(name)); }
  return available;
}

export function webUrl(value: unknown) {
  const url = new URL(text(value, 2000));
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Só são permitidos sites HTTP/HTTPS sem credenciais no URL.");
  return url.href;
}
export async function applicationPath(value: unknown) {
  const name = text(value, 100).replace(/\.app$/i, "").toLocaleLowerCase();
  if (/[\/\\]/.test(name)) throw new Error("Indica apenas o nome da aplicação instalada.");
  for (const directory of ["/Applications", "/System/Applications", "/System/Applications/Utilities", path.join(os.homedir(), "Applications")]) {
    const entries = await fs.readdir(directory).catch(() => []);
    const match = entries.find(entry => entry.toLocaleLowerCase() === `${name}.app`);
    if (match) return path.join(directory, match);
  }
  throw new Error("Aplicação não encontrada. Indica o nome exato da aplicação instalada.");
}

export async function applicationBundleIdentifier(value: unknown) {
  const app = await applicationPath(value);
  const identifier = await command("/usr/libexec/PlistBuddy", ["-c", "Print :CFBundleIdentifier", path.join(app, "Contents", "Info.plist")]);
  if (!/^[A-Za-z0-9.-]+$/.test(identifier)) throw new Error("Não foi possível identificar a aplicação.");
  return identifier;
}

export async function executeMacCapability(name: string, args: Record<string, unknown>, roots: string[]) {
  if (process.platform !== "darwin" || !isMacTool(name)) throw new Error("Capacidade macOS não suportada.");
  switch (name) {
    case "open_application": {
      const app = await applicationPath(args.application);
      await command("/usr/bin/open", ["-a", app]); return { opened: path.basename(app, ".app") };
    }
    case "open_website":
    case "browser_search": {
      const url = name === "browser_search" ? `https://www.google.com/search?q=${encodeURIComponent(text(args.query, 1000))}` : webUrl(args.url);
      const browser = args.application ? await applicationPath(args.application) : null;
      if (browser && !/\/(Google Chrome|Safari|Firefox|Microsoft Edge|Brave Browser|Arc)\.app$/.test(browser)) throw new Error("Escolhe um browser instalado.");
      await command("/usr/bin/open", browser ? ["-a", browser, url] : [url]); return { opened: url };
    }
    case "list_directory": {
      const directory = await permittedPath(text(args.path), roots, false, true);
      const entries = await fs.readdir(directory, { withFileTypes: true });
      return { path: directory, entries: entries.filter(entry => !entry.name.startsWith(".")).slice(0, 200).map(entry => ({ name: entry.name, type: entry.isDirectory() ? "directory" : entry.isSymbolicLink() ? "link" : "file" })), truncated: entries.length > 200 };
    }
    case "create_directory": {
      const directory = await permittedPath(text(args.path), roots, true); await fs.mkdir(directory); return { created: directory };
    }
    case "organize_files": {
      const directory = await permittedPath(text(args.path), roots);
      if (args.strategy !== "type" && args.strategy !== "month") throw new Error("Escolhe strategy type ou month.");
      if (typeof args.preview !== "boolean") throw new Error("Indica preview=true para ver o plano primeiro.");
      return organizeDirectory(directory, args.strategy, args.preview);
    }
    case "computer_screenshot": {
      const application = typeof args.application === "string" && args.application.trim() ? await applicationBundleIdentifier(args.application) : "";
      return nativeCommand(name, application ? { _targetApp: application } : {});
    }
    case "computer_click": case "computer_type": case "computer_key": case "computer_scroll": case "computer_close_window": case "computer_quit_application": return nativeCommand(name, args);
    case "open_finder": {
      await command("/usr/bin/open", ["-a", "Finder", os.homedir()]);
      return { opened: "Finder" };
    }
    case "get_system_info": return { platform: "macos", version: await command("/usr/bin/sw_vers", ["-productVersion"]), deviceName: os.hostname(), user: os.userInfo().username, homeDirectory: os.homedir(), authorizedRoots: roots, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, locale: Intl.DateTimeFormat().resolvedOptions().locale, datetime: new Date().toISOString() };
    case "get_battery_status": {
      const output = await command("/usr/bin/pmset", ["-g", "batt"]);
      const match = output.match(/(\d+)%;\s*([^;]+)/);
      return { hasBattery: !!match, percentage: match ? Number(match[1]) : null, charging: match ? /^(charging|charged)/.test(match[2]) : false, powerSource: output.includes("AC Power") ? "AC" : "battery" };
    }
    case "get_network_status": return { interfaceConnected: Object.values(os.networkInterfaces()).some(items => items?.some(item => !item.internal)), internet: "Não verificada; uma interface ativa não garante acesso à Internet." };
    case "get_system_volume": return { settings: await script("get volume settings") };
    case "set_system_volume": {
      if (typeof args.percent !== "number" || !Number.isInteger(args.percent) || args.percent < 0 || args.percent > 100) throw new Error("Volume deve ser um inteiro de 0 a 100.");
      await script(`set volume output volume ${args.percent}`);
      return { settings: await script("get volume settings") };
    }
    case "set_system_muted": {
      if (typeof args.muted !== "boolean") throw new Error("Estado mute inválido.");
      await script(`set volume output muted ${args.muted}`);
      return { settings: await script("get volume settings") };
    }
    case "read_clipboard": return { text: await command("/usr/bin/pbpaste", []) };
    case "write_clipboard": {
      const value = text(args.text);
      await new Promise<void>((resolve, reject) => {
        const child = execFile("/usr/bin/pbcopy", [], { timeout: 5000 }, error => error ? reject(error) : resolve());
        child.stdin?.end(value);
      });
      return { copied: true };
    }
    case "show_notification": await script('on run argv\ndisplay notification (item 1 of argv) with title "AXION · AIVA"\nend run', [text(args.text, 1000)]); return { submitted: true, note: "Entrega depende das permissões de notificações do macOS." };
    case "find_file": {
      const query = text(args.query, 160).toLocaleLowerCase();
      const found: string[] = []; let visited = 0;
      async function visit(directory: string, depth: number) {
        if (depth > 8 || visited >= 2000 || found.length >= 30) return;
        for (const entry of await fs.readdir(directory, { withFileTypes: true }).catch(() => [])) {
          if (++visited > 2000 || found.length >= 30) return;
          if (entry.isSymbolicLink() || entry.name.startsWith(".") || ["Library", "node_modules", "vendor"].includes(entry.name)) continue;
          const file = path.join(directory, entry.name);
          if (entry.isDirectory()) await visit(file, depth + 1);
          else if (entry.name.toLocaleLowerCase().includes(query)) found.push(file);
        }
      }
      for (const root of roots) await visit(root, 0);
      return { files: found, truncated: visited >= 2000 || found.length >= 30 };
    }
    case "read_file": {
      const file = await permittedPath(text(args.path), roots);
      if (!/\.(txt|md|csv|json)$/i.test(file) || (await fs.stat(file)).size > 64000) throw new Error("Leitura limitada a texto, Markdown, CSV e JSON até 64 KB.");
      return { text: await fs.readFile(file, "utf8") };
    }
    case "create_file": {
      const file = await permittedPath(text(args.path), roots, true);
      if (!/\.(txt|md|csv|json)$/i.test(file)) throw new Error("Apenas ficheiros de texto são permitidos.");
      await fs.writeFile(file, text(args.text), { flag: "wx", mode: 0o600 });
      return { created: file };
    }
    case "copy_file":
    case "move_file": {
      const source = await permittedPath(text(args.path), roots);
      const destination = await permittedPath(text(args.destination), roots, true);
      if (!(await fs.stat(source)).isFile()) throw new Error("Esta operação move ou copia ficheiros individuais.");
      await fs.copyFile(source, destination, constants.COPYFILE_EXCL);
      if (name === "move_file") await fs.unlink(source);
      return { destination };
    }
    case "open_file":
    case "reveal_file": {
      const file = await permittedPath(text(args.path), roots);
      if (!safeDocument(file) || !(await fs.stat(file)).isFile()) throw new Error("Apenas documentos podem ser abertos.");
      await command("/usr/bin/open", name === "reveal_file" ? ["-R", file] : [file]);
      return { opened: file };
    }
    case "sleep_mac": await command("/usr/bin/pmset", ["sleepnow"]); return { requested: true };
    case "run_shell_command": {
      const source = text(args.command, 2000);
      if (/^\s*sudo(?:\s|$)/.test(source)) throw new Error("sudo não é permitido.");
      const cwd = await permittedPath(text(args.cwd), roots, false, true);
      if (!(await fs.stat(cwd)).isDirectory()) throw new Error("cwd tem de ser uma pasta autorizada.");
      try {
        const result = await run("/bin/zsh", ["-lc", source], { cwd, timeout: 15000, maxBuffer: 1_000_000, shell: false });
        return { cwd, stdout: result.stdout.slice(0, 64000), stderr: result.stderr.slice(0, 16000) };
      } catch (error) {
        const failure = error as Error & { stderr?: string; code?: number | string };
        throw new Error(`Comando terminou com erro${failure.code === undefined ? "" : ` (${failure.code})`}: ${String(failure.stderr || failure.message).slice(0, 1000)}`);
      }
    }
  }
}
