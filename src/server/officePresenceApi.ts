import type { IncomingMessage, ServerResponse } from "node:http";
import { authenticateSupabaseUser, readSessionToken } from "./supabaseAuth";
import { getSupabaseBackend } from "./supabaseBackend";
import { getAllowedEmails } from "./supabaseConfig";

function json(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

export async function handleOfficePresenceApi(req: IncomingMessage, res: ServerResponse, next: () => void) {
  if (new URL(req.url || "/", "http://localhost").pathname !== "/api/team/presence") return next();
  if (req.method !== "POST") return json(res, 405, { error: "Método não permitido." });
  try {
    const backend = getSupabaseBackend();
    if (!backend) return json(res, 503, { error: "Presença indisponível." });
    const user = await authenticateSupabaseUser(readSessionToken(req.headers.cookie), backend.client.auth, getAllowedEmails());
    if (!user) return json(res, 401, { error: "Inicia sessão com uma conta AXION autorizada." });
    const { data: membership, error: membershipError } = await backend.client.from("workspace_members")
      .select("workspace_id").eq("user_id", user.id).eq("status", "active").single();
    if (membershipError || !membership) return json(res, 403, { error: "Sem acesso ao Office." });
    // Identity and timestamps come from the authenticated session/database, never the request body.
    const { data: serverTime, error: heartbeatError } = await backend.client.rpc("heartbeat_office_presence", { p_user_id: user.id });
    if (heartbeatError) throw heartbeatError;
    const [members, profiles, presence] = await Promise.all([
      backend.client.from("workspace_members").select("user_id").eq("workspace_id", membership.workspace_id).eq("status", "active"),
      backend.client.from("profiles").select("user_id,preferred_name,display_name,email").eq("workspace_id", membership.workspace_id),
      backend.client.from("office_presence").select("user_id,started_at,last_seen_at").eq("workspace_id", membership.workspace_id),
    ]);
    if (members.error || profiles.error || presence.error) throw new Error("PRESENCE_READ_FAILED");
    const active = new Set((members.data || []).map((member) => member.user_id));
    const seen = new Map((presence.data || []).map((entry) => [entry.user_id, entry]));
    return json(res, 200, {
      serverTime,
      members: (profiles.data || []).filter((profile) => active.has(profile.user_id)).map((profile) => ({
        userId: profile.user_id,
        name: profile.preferred_name || profile.display_name || profile.email,
        startedAt: seen.get(profile.user_id)?.started_at || null,
        lastSeenAt: seen.get(profile.user_id)?.last_seen_at || null,
      })),
    });
  } catch {
    return json(res, 503, { error: "Não foi possível atualizar a presença da equipa." });
  }
}
