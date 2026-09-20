import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeTeamUpdateInput } from "./teamUpdateCore";

export interface TeamUpdateItem {
  id: string;
  authorUserId: string;
  authorName: string;
  title: string;
  description: string;
  publishedOn: string;
  createdAt: string;
}

async function workspaceId(client: SupabaseClient, userId: string) {
  const { data, error } = await client.from("workspace_members").select("workspace_id").eq("user_id", userId).eq("status", "active").single();
  if (error || !data) throw new Error("TEAM_UPDATE_WORKSPACE_NOT_FOUND");
  return data.workspace_id as string;
}

function lisbonDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export async function listTeamUpdates(client: SupabaseClient, userId: string, limit = 30): Promise<TeamUpdateItem[]> {
  const targetWorkspaceId = await workspaceId(client, userId);
  const [{ data: updates, error }, { data: profiles, error: profileError }] = await Promise.all([
    client.from("team_updates").select("id,author_user_id,title,description,published_on,created_at").eq("workspace_id", targetWorkspaceId).order("created_at", { ascending: false }).limit(Math.min(Math.max(limit, 1), 50)),
    client.from("profiles").select("user_id,preferred_name,display_name,email").eq("workspace_id", targetWorkspaceId),
  ]);
  if (error || profileError) throw new Error(`TEAM_UPDATE_READ_FAILED:${(error || profileError)?.message}`);
  const names = new Map((profiles || []).map((profile) => [profile.user_id, profile.preferred_name || profile.display_name || profile.email]));
  return (updates || []).map((update) => ({
    id: update.id,
    authorUserId: update.author_user_id,
    authorName: names.get(update.author_user_id) || "Membro AXION",
    title: update.title,
    description: update.description,
    publishedOn: update.published_on,
    createdAt: update.created_at,
  }));
}

export async function createTeamUpdate(client: SupabaseClient, userId: string, raw: Record<string, unknown>): Promise<TeamUpdateItem> {
  const targetWorkspaceId = await workspaceId(client, userId);
  const input = normalizeTeamUpdateInput(raw);
  const { data, error } = await client.from("team_updates").insert({
    workspace_id: targetWorkspaceId,
    author_user_id: userId,
    title: input.title,
    description: input.description,
    published_on: lisbonDate(),
  }).select("id,author_user_id,title,description,published_on,created_at").single();
  if (error || !data) throw new Error(`TEAM_UPDATE_WRITE_FAILED:${error?.message}`);
  const { data: profile } = await client.from("profiles").select("preferred_name,display_name,email").eq("user_id", userId).single();
  return { id: data.id, authorUserId: data.author_user_id, authorName: profile?.preferred_name || profile?.display_name || profile?.email || "Membro AXION", title: data.title, description: data.description, publishedOn: data.published_on, createdAt: data.created_at };
}
