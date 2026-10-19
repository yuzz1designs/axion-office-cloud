import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_TEAM_UPDATE_MEDIA_FILES, normalizeTeamUpdateInput, pendingTeamUpdateViewerIds, validateTeamUpdateMedia } from "./teamUpdateCore";

export interface TeamUpdateMedia {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  kind: "image" | "video";
  url: string;
}

export interface TeamUpdateViewer {
  userId: string;
  name: string;
  viewedAt: string;
}

export interface TeamUpdateItem {
  id: string;
  authorUserId: string;
  authorName: string;
  title: string;
  description: string;
  publishedOn: string;
  createdAt: string;
  updatedAt: string;
  media: TeamUpdateMedia[];
  viewers: TeamUpdateViewer[];
  pendingViewerNames: string[];
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
  const [{ data: updates, error }, { data: profiles, error: profileError }, { data: memberships, error: membershipError }] = await Promise.all([
    client.from("team_updates").select("id,author_user_id,title,description,published_on,created_at,updated_at").eq("workspace_id", targetWorkspaceId).order("created_at", { ascending: false }).limit(Math.min(Math.max(limit, 1), 50)),
    client.from("profiles").select("user_id,preferred_name,display_name,email").eq("workspace_id", targetWorkspaceId),
    client.from("workspace_members").select("user_id").eq("workspace_id", targetWorkspaceId).eq("status", "active"),
  ]);
  if (error || profileError || membershipError) throw new Error(`TEAM_UPDATE_READ_FAILED:${(error || profileError || membershipError)?.message}`);
  const names = new Map((profiles || []).map((profile) => [profile.user_id, profile.preferred_name || profile.display_name || profile.email]));
  const memberIds = (memberships || []).map((membership) => membership.user_id as string);
  const updateIds = (updates || []).map((update) => update.id);
  const [{ data: mediaRows, error: mediaError }, { data: readRows, error: readsError }] = updateIds.length ? await Promise.all([
    client.from("file_assets").select("id,entity_id,container,object_id,file_name,mime_type,size_bytes").eq("workspace_id", targetWorkspaceId).eq("entity_type", "team_update").in("entity_id", updateIds).order("created_at"),
    client.from("team_update_reads").select("update_id,user_id,viewed_at").eq("workspace_id", targetWorkspaceId).in("update_id", updateIds).order("viewed_at"),
  ]) : [{ data: [], error: null }, { data: [], error: null }];
  if (mediaError || readsError) throw new Error(`TEAM_UPDATE_DETAILS_READ_FAILED:${(mediaError || readsError)?.message}`);
  const mediaByUpdate = new Map<string, TeamUpdateMedia[]>();
  const viewersByUpdate = new Map<string, TeamUpdateViewer[]>();
  await Promise.all((mediaRows || []).map(async (row) => {
    const { data } = await client.storage.from(row.container).createSignedUrl(row.object_id, 21_600);
    const media: TeamUpdateMedia = { id: row.id, name: row.file_name, mimeType: row.mime_type, sizeBytes: Number(row.size_bytes || 0), kind: row.mime_type.startsWith("video/") ? "video" : "image", url: data?.signedUrl || "" };
    mediaByUpdate.set(row.entity_id, [...(mediaByUpdate.get(row.entity_id) || []), media]);
  }));
  for (const row of readRows || []) {
    const viewer = { userId: row.user_id, name: names.get(row.user_id) || "Membro AXION", viewedAt: row.viewed_at };
    viewersByUpdate.set(row.update_id, [...(viewersByUpdate.get(row.update_id) || []), viewer]);
  }
  return (updates || []).map((update) => ({
    id: update.id,
    authorUserId: update.author_user_id,
    authorName: names.get(update.author_user_id) || "Membro AXION",
    title: update.title,
    description: update.description,
    publishedOn: update.published_on,
    createdAt: update.created_at,
    updatedAt: update.updated_at,
    media: mediaByUpdate.get(update.id) || [],
    viewers: viewersByUpdate.get(update.id) || [],
    pendingViewerNames: pendingTeamUpdateViewerIds(update.author_user_id, memberIds, (viewersByUpdate.get(update.id) || []).map((viewer) => viewer.userId)).map((memberId) => names.get(memberId) || "Membro AXION"),
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
  }).select("id,author_user_id,title,description,published_on,created_at,updated_at").single();
  if (error || !data) throw new Error(`TEAM_UPDATE_WRITE_FAILED:${error?.message}`);
  const { data: profile } = await client.from("profiles").select("preferred_name,display_name,email").eq("user_id", userId).single();
  return { id: data.id, authorUserId: data.author_user_id, authorName: profile?.preferred_name || profile?.display_name || profile?.email || "Membro AXION", title: data.title, description: data.description, publishedOn: data.published_on, createdAt: data.created_at, updatedAt: data.updated_at, media: [], viewers: [], pendingViewerNames: [] };
}

export async function updateTeamUpdate(client: SupabaseClient, userId: string, updateId: string, raw: Record<string, unknown>) {
  const targetWorkspaceId = await workspaceId(client, userId);
  const input = normalizeTeamUpdateInput(raw);
  const updatedAt = new Date().toISOString();
  const { data, error } = await client.from("team_updates").update({ title: input.title, description: input.description, updated_at: updatedAt })
    .eq("id", updateId).eq("workspace_id", targetWorkspaceId).eq("author_user_id", userId)
    .select("id,title,description,updated_at").single();
  if (error || !data) throw new Error("TEAM_UPDATE_NOT_FOUND");
  return { id: data.id as string, title: data.title as string, description: data.description as string, updatedAt: data.updated_at as string };
}

export async function deleteTeamUpdate(client: SupabaseClient, userId: string, updateId: string) {
  const targetWorkspaceId = await workspaceId(client, userId);
  const { data: update, error: updateError } = await client.from("team_updates").select("id,title").eq("id", updateId).eq("workspace_id", targetWorkspaceId).eq("author_user_id", userId).single();
  if (updateError || !update) throw new Error("TEAM_UPDATE_NOT_FOUND");
  const { data: assets, error: assetReadError } = await client.from("file_assets").select("id,container,object_id").eq("workspace_id", targetWorkspaceId).eq("entity_type", "team_update").eq("entity_id", updateId);
  if (assetReadError) throw new Error(`TEAM_UPDATE_MEDIA_READ_FAILED:${assetReadError.message}`);
  const { error: deleteError } = await client.from("team_updates").delete().eq("id", updateId).eq("workspace_id", targetWorkspaceId).eq("author_user_id", userId);
  if (deleteError) throw new Error(`TEAM_UPDATE_DELETE_FAILED:${deleteError.message}`);
  if (assets?.length) {
    const { error: metadataError } = await client.from("file_assets").delete().in("id", assets.map((asset) => asset.id));
    if (metadataError) console.error("[TEAM UPDATE MEDIA CLEANUP]", metadataError.message);
    const byContainer = new Map<string, string[]>();
    for (const asset of assets) byContainer.set(asset.container, [...(byContainer.get(asset.container) || []), asset.object_id]);
    for (const [container, paths] of byContainer) {
      const { error } = await client.storage.from(container).remove(paths);
      if (error) console.error("[TEAM UPDATE STORAGE CLEANUP]", error.message);
    }
  }
  return { id: update.id as string, title: update.title as string };
}

export async function deleteTeamUpdateMedia(client: SupabaseClient, userId: string, updateId: string, mediaId: string) {
  const targetWorkspaceId = await workspaceId(client, userId);
  const { data: update, error: updateError } = await client.from("team_updates").select("id")
    .eq("id", updateId).eq("workspace_id", targetWorkspaceId).eq("author_user_id", userId).single();
  if (updateError || !update) throw new Error("TEAM_UPDATE_NOT_FOUND");
  const { data: asset, error } = await client.from("file_assets").select("id,container,object_id")
    .eq("id", mediaId).eq("workspace_id", targetWorkspaceId).eq("entity_type", "team_update").eq("entity_id", updateId).maybeSingle();
  if (error) throw new Error(`TEAM_UPDATE_MEDIA_READ_FAILED:${error.message}`);
  // Idempotent removal supports retrying a save after a dropped connection.
  if (!asset) return;
  const { error: deleteError } = await client.from("file_assets").delete()
    .eq("id", asset.id).eq("workspace_id", targetWorkspaceId).eq("entity_type", "team_update").eq("entity_id", updateId);
  if (deleteError) throw new Error(`TEAM_UPDATE_MEDIA_DELETE_FAILED:${deleteError.message}`);
  const { error: storageError } = await client.storage.from(asset.container).remove([asset.object_id]);
  if (storageError) console.error("[TEAM UPDATE STORAGE CLEANUP]", storageError.message);
  await client.from("team_updates").update({ updated_at: new Date().toISOString() }).eq("id", updateId).eq("workspace_id", targetWorkspaceId);
}

export async function markTeamUpdateViewed(client: SupabaseClient, userId: string, updateId: string): Promise<TeamUpdateViewer | null> {
  const targetWorkspaceId = await workspaceId(client, userId);
  const { data: update, error: updateError } = await client.from("team_updates").select("author_user_id").eq("id", updateId).eq("workspace_id", targetWorkspaceId).single();
  if (updateError || !update) throw new Error("TEAM_UPDATE_NOT_FOUND");
  if (update.author_user_id === userId) return null;
  const { error } = await client.from("team_update_reads").upsert({ update_id: updateId, workspace_id: targetWorkspaceId, user_id: userId }, { onConflict: "update_id,user_id", ignoreDuplicates: true });
  if (error) throw new Error(`TEAM_UPDATE_VIEW_WRITE_FAILED:${error.message}`);
  const [{ data: receipt, error: receiptError }, { data: profile }] = await Promise.all([
    client.from("team_update_reads").select("viewed_at").eq("update_id", updateId).eq("user_id", userId).single(),
    client.from("profiles").select("preferred_name,display_name,email").eq("user_id", userId).single(),
  ]);
  if (receiptError || !receipt) throw new Error(`TEAM_UPDATE_VIEW_READ_FAILED:${receiptError?.message}`);
  return { userId, name: profile?.preferred_name || profile?.display_name || profile?.email || "Membro AXION", viewedAt: receipt.viewed_at };
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
