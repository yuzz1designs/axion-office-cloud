import type { IncomingMessage, ServerResponse } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { AuthProfileStore } from "./authProfileStore";
import { attachDevice, createProfile, detectDevice, profileNeedsSetup, sanitizeProfileInput, type UserProfile } from "./authCore";
import { getAllowedEmails } from "./supabaseConfig";
import { authenticateSupabaseUser, readSessionToken } from "./supabaseAuth";
import { getSupabaseBackend } from "./supabaseBackend";
import { recordTeamActivity } from "./teamActivityStore";
import { DesktopAuthHandoffStore } from "./desktopAuthHandoff";
import { getOwnDiscordIntegration, saveOwnDiscordIntegration } from "./discordIdentity";

const profiles = new AuthProfileStore();
const desktopAuthHandoffs = new DesktopAuthHandoffStore();

function sendJson(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(value));
}

function parseCookie(req: IncomingMessage, name: string) {
  const cookie = req.headers.cookie || "";
  return cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

function appendCookie(res: ServerResponse, value: string) {
  const current = res.getHeader("Set-Cookie");
  const cookies = Array.isArray(current) ? current : current ? [String(current)] : [];
  res.setHeader("Set-Cookie", [...cookies, value]);
}

function setProfileCookie(res: ServerResponse, profileId: string) {
  appendCookie(res, `axion_profile=${profileId}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`);
}

function setSessionCookie(res: ServerResponse, token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  appendCookie(res, `axion_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=3600${secure}`);
}

function getDeviceId(req: IncomingMessage, res: ServerResponse) {
  const existing = parseCookie(req, "axion_device");
  if (existing) return existing;
  const id = randomBytes(16).toString("base64url");
  appendCookie(res, `axion_device=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000`);
  return id;
}

function currentDevice(req: IncomingMessage, res: ServerResponse) {
  const forwardedIp = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return detectDevice({
    id: getDeviceId(req, res),
    userAgent: req.headers["user-agent"],
    ipAddress: forwardedIp || req.socket.remoteAddress || "Local",
  });
}

function clearProfileCookie(res: ServerResponse) {
  res.setHeader("Set-Cookie", [
    "axion_profile=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    "axion_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
  ]);
}

async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

async function supabaseUser(req: IncomingMessage) {
  const backend = getSupabaseBackend();
  if (!backend) return null;
  return authenticateSupabaseUser(readSessionToken(req.headers.cookie), backend.client.auth, getAllowedEmails());
}

async function publicStatus(req: IncomingMessage, res: ServerResponse) {
  const backend = getSupabaseBackend();
  if (backend) {
    const user = await supabaseUser(req);
    if (!user) return { authConfigured: true, authRequired: true, hasProfile: false, profile: null, profileRequired: true };
    let profile = await backend.profiles.findById(user.id);
    const rawDevice = currentDevice(req, res);
    const device = { ...rawDevice, id: createHash("sha256").update(rawDevice.id).digest("hex") };
    if (profile) {
      profile = attachDevice(profile, device);
      await backend.profiles.upsertDevice(user.id, device);
    }
    return {
      authConfigured: true,
      authRequired: false,
      hasProfile: Boolean(profile && !profileNeedsSetup(profile)),
      profile,
      profileRequired: !profile || profileNeedsSetup(profile),
      currentDeviceId: device.id,
    };
  }
  let profile = profiles.findById(parseCookie(req, "axion_profile") || "");
  const device = currentDevice(req, res);
  if (profile) {
    profile = attachDevice(profile, device);
    profiles.upsert(profile);
  }
  return {
    authConfigured: false,
    authRequired: false,
    hasProfile: Boolean(profile && !profileNeedsSetup(profile)),
    profile,
    profileRequired: !profile || profileNeedsSetup(profile),
    currentDeviceId: device.id,
  };
}

export async function handleAuthApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  const url = new URL(req.url || "/", "http://localhost");
  if (!url.pathname.startsWith("/api/profile/") && !url.pathname.startsWith("/api/auth/")) return next();

  try {
    if (url.pathname === "/api/auth/config" && req.method === "GET") {
      const backend = getSupabaseBackend();
      return sendJson(res, 200, {
        configured: Boolean(backend && process.env.SUPABASE_PUBLISHABLE_KEY),
        url: backend ? process.env.SUPABASE_URL : undefined,
        publishableKey: backend ? process.env.SUPABASE_PUBLISHABLE_KEY : undefined,
      });
    }

    if (url.pathname === "/api/auth/desktop/start" && req.method === "POST") {
      return sendJson(res, 200, { state: desktopAuthHandoffs.start() });
    }

    if (url.pathname === "/api/auth/desktop/pending" && req.method === "GET") {
      return sendJson(res, 200, { state: desktopAuthHandoffs.pendingState() });
    }

    if (url.pathname === "/api/auth/desktop/complete" && req.method === "POST") {
      const body = await readJson(req) as { state?: string; accessToken?: string; refreshToken?: string; error?: string };
      const state = String(body.state || "");
      if (!state) return sendJson(res, 400, { error: "Pedido desktop inválido." });
      if (body.error) {
        const completed = desktopAuthHandoffs.complete(state, { ok: false, error: String(body.error).slice(0, 120) });
        return sendJson(res, completed ? 200 : 410, { completed });
      }
      const backend = getSupabaseBackend();
      if (!backend || !body.accessToken || !body.refreshToken) return sendJson(res, 400, { error: "Sessão OAuth incompleta." });
      const user = await authenticateSupabaseUser(body.accessToken, backend.client.auth, getAllowedEmails());
      if (!user) return sendJson(res, 403, { error: "Esta conta Google não está autorizada na AXION." });
      const completed = desktopAuthHandoffs.complete(state, { ok: true, accessToken: body.accessToken, refreshToken: body.refreshToken });
      return sendJson(res, completed ? 200 : 410, { completed });
    }

    if (url.pathname === "/api/auth/desktop/result" && req.method === "GET") {
      const result = desktopAuthHandoffs.consume(url.searchParams.get("state") || "");
      if (result === "pending") return sendJson(res, 202, { pending: true });
      if (!result) return sendJson(res, 410, { error: "O pedido de login expirou." });
      return sendJson(res, 200, result);
    }

    if (url.pathname === "/api/auth/session" && req.method === "POST") {
      const backend = getSupabaseBackend();
      if (!backend) return sendJson(res, 503, { error: "Supabase ainda não está configurado." });
      const body = await readJson(req) as { accessToken?: string };
      const user = await authenticateSupabaseUser(body.accessToken || "", backend.client.auth, getAllowedEmails());
      if (!user) return sendJson(res, 403, { error: "Esta conta Google não está autorizada na AXION." });
      setSessionCookie(res, body.accessToken || "");
      setProfileCookie(res, user.id);
      return sendJson(res, 200, { authenticated: true, user: { id: user.id, email: user.email } });
    }

    if (url.pathname === "/api/auth/session" && req.method === "DELETE") {
      clearProfileCookie(res);
      return sendJson(res, 200, { authenticated: false });
    }

    if (url.pathname === "/api/profile/status" && req.method === "GET") {
      return sendJson(res, 200, await publicStatus(req, res));
    }

    if (url.pathname === "/api/profile/discord" && (req.method === "GET" || req.method === "PUT")) {
      const backend = getSupabaseBackend();
      if (!backend) return sendJson(res, 503, { error: "Supabase ainda não está configurado." });
      const user = await supabaseUser(req);
      if (!user) return sendJson(res, 401, { error: "Inicia sessão com uma conta AXION autorizada." });
      if (req.method === "GET") return sendJson(res, 200, { integration: await getOwnDiscordIntegration(backend.client, user.id) });
      const body = await readJson(req) as { discordUserId?: unknown; displayName?: unknown };
      const discordUserId = String(body.discordUserId || "").trim();
      const displayName = String(body.displayName || "").trim().slice(0, 100);
      if (!/^\d{17,20}$/.test(discordUserId)) return sendJson(res, 400, { error: "O Discord User ID deve conter entre 17 e 20 algarismos." });
      try {
        const integration = await saveOwnDiscordIntegration(backend.client, user.id, discordUserId, displayName);
        await recordTeamActivity(backend.client, user.id, "discord.account.linked", "integration", user.id, { name: displayName || discordUserId });
        return sendJson(res, 200, { integration });
      } catch (error) {
        if (error instanceof Error && error.message === "DISCORD_USER_ALREADY_LINKED") return sendJson(res, 409, { error: "Este Discord User ID já está associado a outro perfil AXION." });
        throw error;
      }
    }

    if (url.pathname === "/api/profile/create" && req.method === "POST") {
      const backend = getSupabaseBackend();
      if (backend) {
        const user = await supabaseUser(req);
        if (!user) return sendJson(res, 401, { error: "Inicia sessão com uma conta AXION autorizada." });
        const existing = await backend.profiles.findById(user.id);
        if (!existing) return sendJson(res, 409, { error: "O perfil Supabase ainda não foi provisionado." });
        const wasIncomplete = profileNeedsSetup(existing);
        const input = await readJson(req) as Partial<UserProfile>;
        let profile = sanitizeProfileInput(existing, { ...input, id: user.id, email: user.email });
        if (profileNeedsSetup(profile)) return sendJson(res, 400, { error: "Nome, função e email são obrigatórios." });
        const rawDevice = currentDevice(req, res);
        const device = { ...rawDevice, id: createHash("sha256").update(rawDevice.id).digest("hex") };
        profile = attachDevice(profile, device);
        await backend.profiles.upsert(profile);
        await backend.profiles.upsertDevice(user.id, device);
        await recordTeamActivity(backend.client, user.id, wasIncomplete ? "profile.created" : "profile.updated", "profile", user.id);
        setProfileCookie(res, user.id);
        return sendJson(res, 200, { profile, axKey: profile.axKey, profileRequired: false, currentDeviceId: device.id });
      }
      const existing = profiles.findById(parseCookie(req, "axion_profile") || "");
      const input = await readJson(req) as Partial<UserProfile>;
      let profile = existing
        ? sanitizeProfileInput(existing, input)
        : createProfile(input);
      if (profileNeedsSetup(profile)) return sendJson(res, 400, { error: "Nome, função e email são obrigatórios." });
      const device = currentDevice(req, res);
      profile = attachDevice(profile, device);
      profiles.upsert(profile);
      setProfileCookie(res, profile.id);
      return sendJson(res, 200, { profile, axKey: profile.axKey, profileRequired: false, currentDeviceId: device.id });
    }

    if (url.pathname === "/api/profile/reset-session" && req.method === "POST") {
      clearProfileCookie(res);
      return sendJson(res, 200, { ok: true });
    }

    return sendJson(res, 404, { error: "Not found" });
  } catch {
    return sendJson(res, 500, { error: "Não foi possível processar o perfil AXION." });
  }
}
