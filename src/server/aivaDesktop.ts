import type { SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import type { DesktopStatus } from "../lib/aivaCapabilities";

const connections = new Map<string, { token: string; deviceId: string; hash: string }>();
async function request(route: string, userId: string, token = "", body?: unknown) {
  const response = await fetch(`http://127.0.0.1:${process.env.AXION_COMPANION_PORT || "4319"}${route}`, { method: body ? "POST" : "GET", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "X-Axion-User": userId }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Companion indisponível.");
  return data;
}
async function trusted(client: SupabaseClient, userId: string) {
  let connection = connections.get(userId);
  if (!connection && process.env.AXION_COMPANION_AUTO_PAIR_CODE) {
    await pairDesktop(client, userId, process.env.AXION_COMPANION_AUTO_PAIR_CODE);
    connection = connections.get(userId);
  }
  if (!connection) throw new Error("Associa primeiro o Desktop Companion a este utilizador.");
  const { data, error } = await client.from("user_devices").select("revoked_at").eq("user_id", userId).eq("device_id_hash", connection.hash).maybeSingle();
  if (error || !data || data.revoked_at) { connections.delete(userId); throw new Error("Dispositivo revogado ou autorização indisponível."); }
  return connection;
}
export async function pairDesktop(client: SupabaseClient, userId: string, code: string) {
  const data = await request("/pair", userId, "", { code, userId });
  const hash = createHash("sha256").update(`aiva-companion:${data.deviceId}`).digest("hex");
  const { error } = await client.from("user_devices").upsert({ user_id: userId, device_id_hash: hash, label: `AIVA · ${data.deviceName}`, operating_system: "macOS", browser: "AXION Desktop Companion", revoked_at: null }, { onConflict: "user_id,device_id_hash" });
  if (error) { await request("/revoke", userId, data.token, {}).catch(() => undefined); throw new Error("Não foi possível registar o dispositivo. Reinicia o Companion."); }
  connections.set(userId, { token: data.token, deviceId: data.deviceId, hash });
  return { connected: true, deviceName: data.deviceName, capabilities: data.capabilities };
}
export async function desktopStatus(client: SupabaseClient, userId: string): Promise<DesktopStatus> {
  try { const connection = await trusted(client, userId); return await request("/status", userId, connection.token); }
  catch (error) { return { connected: false, capabilities: [], reason: error instanceof Error ? error.message : "Companion desligado." }; }
}
export async function revokeDesktop(client: SupabaseClient, userId: string) {
  const connection = connections.get(userId);
  if (connection) {
    const { error } = await client.from("user_devices").update({ revoked_at: new Date().toISOString() }).eq("user_id", userId).eq("device_id_hash", connection.hash);
    if (error) throw new Error("Não foi possível revogar o dispositivo.");
    connections.delete(userId);
    await request("/revoke", userId, connection.token, {}).catch(() => undefined);
  }
  return { revoked: true };
}
export async function requestDesktopPermissions(client: SupabaseClient, userId: string) {
  const connection = await trusted(client, userId);
  return request("/permissions", userId, connection.token, {});
}
export async function listDesktopApplications(client: SupabaseClient, userId: string) {
  const connection = await trusted(client, userId);
  return request("/apps", userId, connection.token);
}
export async function authorizeDesktopApplication(client: SupabaseClient, userId: string, bundleId: string, authorized: boolean) {
  const connection = await trusted(client, userId);
  return request("/apps/authorize", userId, connection.token, { bundleId, authorized });
}
export async function executeDesktop(client: SupabaseClient, userId: string, name: string, args: unknown, approved = false) {
  const connection = await trusted(client, userId);
  return request("/execute", userId, connection.token, { name, arguments: args, approved });
}
