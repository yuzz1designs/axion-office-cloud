import { createServer } from "node:http";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { hostname, homedir } from "node:os";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { applicationBundleIdentifier, discoverMacCapabilities, executeMacCapability } from "./macCapabilities";
import { nativeCommand, nativeStatus } from "./native";
import { COMPUTER_CONFIRM_TOOLS } from "../src/lib/aivaCapabilities";
import { AppRegistry } from "./appRegistry";

if (process.platform !== "darwin") throw new Error("O Companion requer macOS.");
const suppliedRoots = process.argv.slice(2).filter(value => value !== "--no-files");
const roots = await Promise.all((process.argv.includes("--no-files") ? [] : suppliedRoots.length ? suppliedRoots : [homedir()]).map(value => realpath(resolve(value))));
if (roots.some(root => ["/", "/Users", "/System", "/Library", "/Applications"].includes(root))) throw new Error("Escolhe pastas de utilizador, não diretórios do sistema.");
const dataDirectory = process.env.AXION_COMPANION_DATA_DIR || process.cwd();
const deviceIdFile = resolve(dataDirectory, "device-id");
await mkdir(dataDirectory, { recursive: true });
let deviceId = (await readFile(deviceIdFile, "utf8").catch(() => "")).trim();
if (!/^[a-f0-9-]{36}$/i.test(deviceId)) { deviceId = randomUUID(); await writeFile(deviceIdFile, deviceId, { mode: 0o600 }); }
const code = randomBytes(16).toString("hex");
const expires = Date.now() + 10 * 60_000;
let owner = "";
let token = "";
let attempts = 0;
let busy = false;
let observedApp: { bundleId: string; at: number } | null = null;
let capabilities = await discoverMacCapabilities(roots);
const appRegistry = new AppRegistry(dataDirectory);
const port = Number(process.env.AXION_COMPANION_PORT || 4319);
const equal = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const server = createServer(async (req, res) => {
  const send = (status: number, body: unknown) => { res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify(body)); };
  // This API is only for the AXION backend, never browser-origin requests.
  const address = server.address();
  if (req.headers.origin || !address || typeof address === "string" || req.headers.host !== `127.0.0.1:${address.port}`) return send(403, { error: "Origem não permitida." });
  try {
    let raw = "";
    for await (const chunk of req) { raw += chunk.toString(); if (Buffer.byteLength(raw) > 64000) return send(413, { error: "Pedido demasiado grande." }); }
    const body = raw ? JSON.parse(raw) : {};
    if (req.url === "/pair" && req.method === "POST") {
      if (owner || ++attempts > 5 || Date.now() > expires || !equal(String(body.code || ""), code) || !/^[a-f0-9-]{36}$/i.test(String(body.userId))) return send(403, { error: "Código expirado, inválido ou já utilizado. Reinicia o Companion." });
      owner = body.userId; token = randomBytes(32).toString("hex");
      return send(200, { token, deviceId, deviceName: hostname(), capabilities });
    }
    if (!token || !equal(String(req.headers.authorization || ""), `Bearer ${token}`) || req.headers["x-axion-user"] !== owner) return send(401, { error: "Dispositivo não autorizado." });
    if (req.url === "/status" && req.method === "GET") {
      capabilities = await discoverMacCapabilities(roots);
      const permissions = await nativeStatus();
      return send(200, { connected: true, runtime: "desktop", deviceId, deviceName: hostname(), capabilities, roots, arbitraryAppControl: capabilities.includes("computer_click"), shell: capabilities.includes("run_shell_command"), permissions: { ...permissions, authorizedFolders: roots.length > 0 } });
    }
    if (req.url === "/permissions" && req.method === "POST") return send(200, await nativeCommand("request-permissions", {}));
    if (req.url === "/apps" && req.method === "GET") return send(200, { applications: await appRegistry.list() });
    if (req.url === "/apps/authorize" && req.method === "POST") return send(200, { applications: await appRegistry.authorize(String(body.bundleId || ""), body.authorized === true) });
    if (req.url === "/revoke" && req.method === "POST") { token = ""; return send(200, { revoked: true }); }
    if (req.url !== "/execute" || req.method !== "POST") return send(404, { error: "Operação desconhecida." });
    if (!capabilities.includes(body.name)) return send(403, { error: "Capacidade indisponível ou não autorizada." });
    if (COMPUTER_CONFIRM_TOOLS.has(body.name) && body.approved !== true) return send(403, { error: "Esta interação requer confirmação explícita." });
    if (busy) return send(409, { error: "Existe uma operação em curso." });
    busy = true;
    try {
      const args = { ...(body.arguments || {}) };
      delete args._targetApp;
      if (body.name === "open_application" || (["open_website", "browser_search", "computer_screenshot"].includes(body.name) && args.application)) {
        const bundleId = await applicationBundleIdentifier(args.application);
        if (!(await appRegistry.isAuthorized(bundleId))) return send(403, { error: "Autoriza primeiro esta aplicação nas Definições do AXION Desktop." });
      }
      if (body.name.startsWith("computer_") && body.name !== "computer_screenshot") {
        if (!observedApp || Date.now() - observedApp.at > 60000) return send(409, { error: "Captura primeiro o ecrã para confirmar a aplicação e as coordenadas atuais." });
        if (!(await appRegistry.isAuthorized(observedApp.bundleId))) return send(403, { error: "A aplicação observada já não está autorizada." });
        args._targetApp = observedApp.bundleId;
      }
      const result = await executeMacCapability(body.name, args, roots);
      if (body.name === "computer_screenshot") {
        observedApp = typeof result.application === "string" && result.application ? { bundleId: result.application, at: Date.now() } : null;
        if (observedApp && !(await appRegistry.isAuthorized(observedApp.bundleId))) { observedApp = null; return send(403, { error: "Autoriza a aplicação visível nas Definições antes de a AIVA observar o ecrã." }); }
      }
      else if (body.name.startsWith("computer_")) observedApp = null;
      return send(200, result);
    }
    finally { busy = false; }
  } catch (error) { return send(400, { error: error instanceof Error ? error.message : "Operação falhou." }); }
});
server.requestTimeout = 15000;
server.on("error", error => {
  if ((error as NodeJS.ErrnoException).code === "EADDRINUSE") {
    console.log(`O AXION Desktop Companion já está ativo na porta ${port}. Não é necessário executar o comando novamente.`);
    process.exitCode = 0;
    return;
  }
  throw error;
});
server.listen(port, "127.0.0.1", () => console.log(`AXION Desktop Companion · macOS\nPorta: ${(server.address() as { port: number }).port}\nCódigo de associação (10 minutos, uso único): ${code}\nNa AIVA, abre macOS e introduz este código.\nPastas autorizadas: ${roots.join(", ") || "nenhuma"}`));
