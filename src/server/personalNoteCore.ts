export const NOTE_CATEGORIES = ["general", "idea", "suggestion", "reminder"] as const;
export const NOTE_VISIBILITIES = ["private", "team"] as const;
export type NoteCategory = typeof NOTE_CATEGORIES[number];
export type NoteVisibility = typeof NOTE_VISIBILITIES[number];
export interface NoteChecklistItem { id: string; text: string; completed: boolean }

const ids = /^[a-zA-Z0-9_-]{1,80}$/;
export function normalizeNoteInput(raw: Record<string, unknown>, partial = false) {
  const result: Record<string, unknown> = {};
  if (!partial || "title" in raw) { const value = String(raw.title || "").trim(); if (value.length > 160) throw new Error("NOTE_TITLE_TOO_LONG"); result.title = value; }
  if (!partial || "content" in raw) { const value = String(raw.content || ""); if (value.length > 20_000) throw new Error("NOTE_CONTENT_TOO_LONG"); result.content = value; }
  if (!partial || "category" in raw) { const value = String(raw.category || "general") as NoteCategory; if (!NOTE_CATEGORIES.includes(value)) throw new Error("NOTE_CATEGORY_INVALID"); result.category = value; }
  if (!partial || "visibility" in raw) { const value = String(raw.visibility || "private") as NoteVisibility; if (!NOTE_VISIBILITIES.includes(value)) throw new Error("NOTE_VISIBILITY_INVALID"); result.visibility = value; }
  if (!partial || "color" in raw) { const value = String(raw.color || "#00f0ff"); if (!/^#[0-9a-fA-F]{6}$/.test(value)) throw new Error("NOTE_COLOR_INVALID"); result.color = value.toLowerCase(); }
  if (!partial || "checklist" in raw) {
    if (!Array.isArray(raw.checklist) || raw.checklist.length > 100) throw new Error("NOTE_CHECKLIST_INVALID");
    result.checklist = raw.checklist.map((item) => { const value = item as Record<string, unknown>; const text = String(value.text || "").trim(); const id = String(value.id || ""); if (!ids.test(id) || !text || text.length > 500) throw new Error("NOTE_CHECKLIST_INVALID"); return { id, text, completed: Boolean(value.completed) }; });
  }
  for (const key of ["pinned", "archived"] as const) if (!partial || key in raw) result[key] = Boolean(raw[key]);
  if (!partial || "reminderAt" in raw) {
    if (!raw.reminderAt) result.reminderAt = null;
    else { const date = new Date(String(raw.reminderAt)); if (!Number.isFinite(date.getTime())) throw new Error("NOTE_REMINDER_INVALID"); result.reminderAt = date.toISOString(); }
  }
  if ("reminderCompleted" in raw) result.reminderCompleted = Boolean(raw.reminderCompleted);
  return result;
}
