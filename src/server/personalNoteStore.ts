import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeNoteInput, type NoteCategory, type NoteChecklistItem, type NoteVisibility } from "./personalNoteCore";

export interface PersonalNote {
  id: string; ownerUserId: string; ownerName: string; title: string; content: string; category: NoteCategory; visibility: NoteVisibility;
  color: string; checklist: NoteChecklistItem[]; pinned: boolean; archived: boolean; reminderAt: string | null;
  reminderCompletedAt: string | null; createdAt: string; updatedAt: string;
}

async function getWorkspaceId(client: SupabaseClient, userId: string) {
  const { data, error } = await client.from("workspace_members").select("workspace_id").eq("user_id", userId).eq("status", "active").single();
  if (error || !data) throw new Error("NOTE_WORKSPACE_NOT_FOUND");
  return data.workspace_id as string;
}

async function mapNotes(client: SupabaseClient, rows: any[]): Promise<PersonalNote[]> {
  const ids = [...new Set(rows.map((row) => row.owner_user_id))];
  const { data: profiles } = ids.length ? await client.from("profiles").select("user_id,preferred_name,display_name,email").in("user_id", ids) : { data: [] };
  const names = new Map((profiles || []).map((row) => [row.user_id, row.preferred_name || row.display_name || row.email]));
  return rows.map((row) => ({ id: row.id, ownerUserId: row.owner_user_id, ownerName: names.get(row.owner_user_id) || "Membro AXION", title: row.title, content: row.content, category: row.category, visibility: row.visibility, color: row.color, checklist: Array.isArray(row.checklist) ? row.checklist : [], pinned: Boolean(row.pinned), archived: Boolean(row.archived), reminderAt: row.reminder_at, reminderCompletedAt: row.reminder_completed_at, createdAt: row.created_at, updatedAt: row.updated_at }));
}

const fields = "id,owner_user_id,title,content,category,visibility,color,checklist,pinned,archived,reminder_at,reminder_completed_at,created_at,updated_at";

export async function listPersonalNotes(client: SupabaseClient, userId: string, archived = false) {
  const workspaceId = await getWorkspaceId(client, userId);
  const { data, error } = await client.from("personal_notes").select(fields).eq("workspace_id", workspaceId).eq("archived", archived).or(`owner_user_id.eq.${userId},visibility.eq.team`).order("pinned", { ascending: false }).order("updated_at", { ascending: false });
  if (error) throw new Error(`NOTE_LIST_FAILED:${error.message}`);
  return mapNotes(client, data || []);
}

export async function listDuePersonalNotes(client: SupabaseClient, userId: string) {
  const workspaceId = await getWorkspaceId(client, userId);
  const { data, error } = await client.from("personal_notes").select(fields).eq("workspace_id", workspaceId).eq("owner_user_id", userId).eq("archived", false).is("reminder_completed_at", null).not("reminder_at", "is", null).lte("reminder_at", new Date().toISOString()).order("reminder_at");
  if (error) throw new Error(`NOTE_REMINDER_LIST_FAILED:${error.message}`);
  return mapNotes(client, data || []);
}

export async function createPersonalNote(client: SupabaseClient, userId: string, raw: Record<string, unknown>) {
  const workspaceId = await getWorkspaceId(client, userId);
  const value = normalizeNoteInput({ title: "", content: "", category: "general", visibility: "private", color: "#00f0ff", checklist: [], pinned: false, archived: false, reminderAt: null, ...raw });
  const { data, error } = await client.from("personal_notes").insert({ workspace_id: workspaceId, owner_user_id: userId, title: value.title, content: value.content, category: value.category, visibility: value.visibility, color: value.color, checklist: value.checklist, pinned: value.pinned, archived: value.archived, reminder_at: value.reminderAt }).select(fields).single();
  if (error || !data) throw new Error(`NOTE_CREATE_FAILED:${error?.message}`);
  return (await mapNotes(client, [data]))[0];
}

export async function updatePersonalNote(client: SupabaseClient, userId: string, noteId: string, raw: Record<string, unknown>) {
  const workspaceId = await getWorkspaceId(client, userId);
  const value = normalizeNoteInput(raw, true);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const columns: Record<string, string> = { title: "title", content: "content", category: "category", visibility: "visibility", color: "color", checklist: "checklist", pinned: "pinned", archived: "archived", reminderAt: "reminder_at" };
  for (const [key, column] of Object.entries(columns)) if (key in value) patch[column] = value[key];
  if ("reminderAt" in value) patch.reminder_notified_at = null;
  if ("reminderCompleted" in value) patch.reminder_completed_at = value.reminderCompleted ? new Date().toISOString() : null;
  const { data, error } = await client.from("personal_notes").update(patch).eq("id", noteId).eq("workspace_id", workspaceId).eq("owner_user_id", userId).select(fields).single();
  if (error || !data) throw new Error("NOTE_NOT_FOUND");
  return (await mapNotes(client, [data]))[0];
}

export async function deletePersonalNote(client: SupabaseClient, userId: string, noteId: string) {
  const workspaceId = await getWorkspaceId(client, userId);
  const { data, error } = await client.from("personal_notes").delete().eq("id", noteId).eq("workspace_id", workspaceId).eq("owner_user_id", userId).select("id").single();
  if (error || !data) throw new Error("NOTE_NOT_FOUND");
  return data.id as string;
}
