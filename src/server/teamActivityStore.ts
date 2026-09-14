import type { SupabaseClient } from "@supabase/supabase-js";
import { describeAuditAction } from "./teamActivityCore";

export interface TeamActivityItem {
  id: string;
  actorUserId: string;
  actorName: string;
  action: string;
  createdAt: string;
}

async function workspaceId(client: SupabaseClient, userId: string) {
  const { data, error } = await client.from("workspace_members")
    .select("workspace_id").eq("user_id", userId).eq("status", "active").single();
  if (error || !data) throw new Error("ACTIVITY_WORKSPACE_NOT_FOUND");
  return data.workspace_id as string;
}

export async function recordTeamActivity(
  client: SupabaseClient,
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata: Record<string, unknown> = {},
) {
  const targetWorkspaceId = await workspaceId(client, actorUserId);
  let lastError = "unknown";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { error } = await client.from("audit_logs").insert({
      workspace_id: targetWorkspaceId,
      actor_user_id: actorUserId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });
    if (!error) return;
    lastError = error.message;
  }
  throw new Error(`ACTIVITY_WRITE_FAILED:${lastError}`);
}

export async function listTeamActivity(client: SupabaseClient, currentUserId: string, limit = 20): Promise<TeamActivityItem[]> {
  const targetWorkspaceId = await workspaceId(client, currentUserId);
  const [{ data: logs, error }, { data: profiles, error: profileError }] = await Promise.all([
    client.from("audit_logs").select("id,actor_user_id,action,metadata,created_at")
      .eq("workspace_id", targetWorkspaceId)
      .neq("action", "aiva.tool.executed")
      .order("created_at", { ascending: false }).limit(limit),
    client.from("profiles").select("user_id,preferred_name,display_name,email").eq("workspace_id", targetWorkspaceId),
  ]);
  if (error || profileError) throw new Error(`ACTIVITY_READ_FAILED:${(error || profileError)?.message}`);
  const names = new Map((profiles || []).map((profile) => [
    profile.user_id,
    profile.preferred_name || profile.display_name || profile.email,
  ]));
  return (logs || []).map((log) => ({
    id: String(log.id),
    actorUserId: log.actor_user_id,
    actorName: names.get(log.actor_user_id) || "Membro AXION",
    action: describeAuditAction(log.action, log.metadata || {}),
    createdAt: log.created_at,
  }));
}
