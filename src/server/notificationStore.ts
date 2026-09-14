import type { SupabaseClient } from "@supabase/supabase-js";

export async function listNotificationReads(client: SupabaseClient, userId: string): Promise<string[]> {
  const { data, error } = await client.from("notification_reads").select("notification_key").eq("user_id", userId);
  if (error) throw new Error(`NOTIFICATION_READS_FAILED:${error.message}`);
  return (data || []).map((item) => String(item.notification_key));
}

export async function markNotificationsRead(client: SupabaseClient, userId: string, keys: string[]): Promise<string[]> {
  const normalized = [...new Set(keys.map((key) => key.trim()).filter(Boolean))].slice(0, 250);
  if (!normalized.length) return [];
  const readAt = new Date().toISOString();
  const { error } = await client.from("notification_reads").upsert(
    normalized.map((notificationKey) => ({ user_id: userId, notification_key: notificationKey, read_at: readAt })),
    { onConflict: "user_id,notification_key" },
  );
  if (error) throw new Error(`NOTIFICATION_MARK_READ_FAILED:${error.message}`);
  return normalized;
}
