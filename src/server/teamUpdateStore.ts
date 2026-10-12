import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_TEAM_UPDATE_MEDIA_FILES, normalizeTeamUpdateInput, validateTeamUpdateMedia } from "./teamUpdateCore";

export interface TeamUpdateMedia {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  kind: "image" | "video";
  url: string;
}

export interface TeamUpdateItem {
  id: string;
  authorUserId: string;
  authorName: string;
  title: string;
  description: string;
  publishedOn: string;
  createdAt: string;
  media: TeamUpdateMedia[];
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
  const updateIds = (updates || []).map((update) => update.id);
  const { data: mediaRows, error: mediaError } = updateIds.length
    ? await client.from("file_assets").select("id,entity_id,container,object_id,file_name,mime_type,size_bytes").eq("workspace_id", targetWorkspaceId).eq("entity_type", "team_update").in("entity_id", updateIds).order("created_at")
    : { data: [], error: null };
  if (mediaError) throw new Error(`TEAM_UPDATE_MEDIA_READ_FAILED:${mediaError.message}`);
  const mediaByUpdate = new Map<string, TeamUpdateMedia[]>();
  await Promise.all((mediaRows || []).map(async (row) => {
    const { data } = await client.storage.from(row.container).createSignedUrl(row.object_id, 21_600);
    const media: TeamUpdateMedia = { id: row.id, name: row.file_name, mimeType: row.mime_type, sizeBytes: Number(row.size_bytes || 0), kind: row.mime_type.startsWith("video/") ? "video" : "image", url: data?.signedUrl || "" };
    mediaByUpdate.set(row.entity_id, [...(mediaByUpdate.get(row.entity_id) || []), media]);
  }));
  return (updates || []).map((update) => ({
    id: update.id,
    authorUserId: update.author_user_id,
    authorName: names.get(update.author_user_id) || "Membro AXION",
    title: update.title,
    description: update.description,
    publishedOn: update.published_on,
    createdAt: update.created_at,
    media: mediaByUpdate.get(update.id) || [],
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
  return { id: data.id, authorUserId: data.author_user_id, authorName: profile?.preferred_name || profile?.display_name || profile?.email || "Membro AXION", title: data.title, description: data.description, publishedOn: data.published_on, createdAt: data.created_at, media: [] };
}

export async function attachTeamUpdateMedia(client: SupabaseClient, userId: string, updateId: string, file: { name: string; type: string; bytes: Buffer }): Promise<TeamUpdateMedia> {
  const targetWorkspaceId = await workspaceId(client, userId);
  const { data: update, error: updateError } = await client.from("team_updates").select("id").eq("id", updateId).eq("workspace_id", targetWorkspaceId).eq("author_user_id", userId).single();
  if (updateError || !update) throw new Error("TEAM_UPDATE_NOT_FOUND");
  const { count, error: countError } = await client.from("file_assets").select("id", { count: "exact", head: true }).eq("workspace_id", targetWorkspaceId).eq("entity_type", "team_update").eq("entity_id", updateId);
  if (countError) throw new Error(`TEAM_UPDATE_MEDIA_READ_FAILED:${countError.message}`);
  if ((count || 0) >= MAX_TEAM_UPDATE_MEDIA_FILES) throw new Error("TEAM_UPDATE_MEDIA_LIMIT");
  const mimeType = validateTeamUpdateMedia(file.type, file.bytes.length);
  const safeName = file.name.replace(/[^a-zA-Z0-9À-ÿ._ -]/g, "_").slice(0, 160) || (mimeType.startsWith("video/") ? "video" : "imagem");
  const objectId = `${targetWorkspaceId}/updates/${updateId}/${randomUUID()}-${safeName}`;
  const { error: uploadError } = await client.storage.from("attachments").upload(objectId, file.bytes, { contentType: mimeType, upsert: false });
  if (uploadError) throw new Error(`TEAM_UPDATE_MEDIA_UPLOAD_FAILED:${uploadError.message}`);
  const { data, error } = await client.from("file_assets").insert({ workspace_id: targetWorkspaceId, owner_user_id: userId, provider: "supabase", container: "attachments", object_id: objectId, file_name: safeName, mime_type: mimeType, size_bytes: file.bytes.length, entity_type: "team_update", entity_id: updateId }).select("id,container,object_id,file_name,mime_type,size_bytes").single();
  if (error || !data) {
    await client.storage.from("attachments").remove([objectId]);
    throw new Error(`TEAM_UPDATE_MEDIA_RECORD_FAILED:${error?.message}`);
  }
  await client.from("team_updates").update({ updated_at: new Date().toISOString() }).eq("id", updateId);
  const { data: signed } = await client.storage.from(data.container).createSignedUrl(data.object_id, 21_600);
  return { id: data.id, name: data.file_name, mimeType: data.mime_type, sizeBytes: Number(data.size_bytes || 0), kind: data.mime_type.startsWith("video/") ? "video" : "image", url: signed?.signedUrl || "" };
}
