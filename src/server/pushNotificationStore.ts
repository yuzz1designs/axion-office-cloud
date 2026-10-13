import type { SupabaseClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { isExpiredPushStatus, normalizePushSubscription, teamUpdatePushEventKey, validatePushDeviceId, type BrowserPushSubscriptionInput } from "./pushNotificationCore";

interface VapidConfig { subject: string; publicKey: string; privateKey: string }
interface PushRow { id: string; user_id: string; endpoint: string; p256dh: string; auth: string }

export function getVapidConfig(): VapidConfig | null {
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:axionportugal@gmail.com";
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() || "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() || "";
  return subject && publicKey && privateKey ? { subject, publicKey, privateKey } : null;
}

async function workspaceId(client: SupabaseClient, userId: string) {
  const { data, error } = await client.from("workspace_members").select("workspace_id").eq("user_id", userId).eq("status", "active").single();
  if (error || !data) throw new Error("PUSH_WORKSPACE_NOT_FOUND");
  return data.workspace_id as string;
}

export async function getPushStatus(client: SupabaseClient, userId: string, rawDeviceId: unknown) {
  const deviceId = validatePushDeviceId(rawDeviceId);
  const { data, error } = await client.from("push_subscriptions").select("id,updated_at").eq("user_id", userId).eq("device_id", deviceId).maybeSingle();
  if (error) throw new Error(`PUSH_STATUS_FAILED:${error.message}`);
  const vapid = getVapidConfig();
  return { configured: Boolean(vapid), subscribed: Boolean(data), subscriptionId: data?.id || null, updatedAt: data?.updated_at || null, publicKey: vapid?.publicKey || null };
}

export async function savePushSubscription(client: SupabaseClient, userId: string, rawDeviceId: unknown, rawSubscription: unknown, userAgent: string) {
  const deviceId = validatePushDeviceId(rawDeviceId);
  const subscription = normalizePushSubscription(rawSubscription);
  const targetWorkspaceId = await workspaceId(client, userId);
  await client.from("push_subscriptions").delete().eq("endpoint", subscription.endpoint).eq("device_id", deviceId);
  const { data, error } = await client.from("push_subscriptions").upsert({
    workspace_id: targetWorkspaceId, user_id: userId, device_id: deviceId, endpoint: subscription.endpoint,
    p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, user_agent: userAgent.slice(0, 500), updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,device_id" }).select("id,updated_at").single();
  if (error || !data) throw new Error(`PUSH_SUBSCRIBE_FAILED:${error?.message}`);
  return { subscriptionId: data.id, updatedAt: data.updated_at };
}

export async function removePushSubscription(client: SupabaseClient, userId: string, rawDeviceId: unknown) {
  const deviceId = validatePushDeviceId(rawDeviceId);
  const { error } = await client.from("push_subscriptions").delete().eq("user_id", userId).eq("device_id", deviceId);
  if (error) throw new Error(`PUSH_UNSUBSCRIBE_FAILED:${error.message}`);
}

async function reserveDelivery(client: SupabaseClient, eventKey: string, subscription: PushRow) {
  const { data, error } = await client.from("push_notification_deliveries").insert({ event_key: eventKey, subscription_id: subscription.id, user_id: subscription.user_id }).select("id").single();
  if (error?.code === "23505") return null;
  if (error || !data) throw new Error(`PUSH_DELIVERY_RESERVE_FAILED:${error?.message}`);
  return data.id as string;
}

async function deliver(client: SupabaseClient, vapid: VapidConfig, eventKey: string, subscription: PushRow, payload: Record<string, unknown>) {
  const deliveryId = await reserveDelivery(client, eventKey, subscription);
  if (!deliveryId) return "duplicate" as const;
  try {
    await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(payload), {
      TTL: 86_400,
      urgency: "normal",
      timeout: 10_000,
      vapidDetails: { subject: vapid.subject, publicKey: vapid.publicKey, privateKey: vapid.privateKey },
    });
    await client.from("push_notification_deliveries").update({ status: "sent", completed_at: new Date().toISOString() }).eq("id", deliveryId);
    return "sent" as const;
  } catch (error) {
    const statusCode = typeof error === "object" && error && "statusCode" in error ? Number((error as { statusCode?: number }).statusCode) : undefined;
    const expired = isExpiredPushStatus(statusCode);
    await client.from("push_notification_deliveries").update({ status: expired ? "expired" : "failed", error_code: statusCode ? String(statusCode) : "SEND_FAILED", completed_at: new Date().toISOString() }).eq("id", deliveryId);
    if (expired) await client.from("push_subscriptions").delete().eq("id", subscription.id);
    return expired ? "expired" as const : "failed" as const;
  }
}

export async function dispatchTeamUpdatePush(client: SupabaseClient, input: { updateId: string; authorUserId: string; authorName: string }) {
  const vapid = getVapidConfig();
  if (!vapid) return { configured: false, sent: 0 };
  const { data: update, error: updateError } = await client.from("team_updates").select("workspace_id").eq("id", input.updateId).eq("author_user_id", input.authorUserId).single();
  if (updateError || !update) throw new Error("PUSH_UPDATE_NOT_FOUND");
  const { data: members, error: memberError } = await client.from("workspace_members").select("user_id").eq("workspace_id", update.workspace_id).eq("status", "active").neq("user_id", input.authorUserId);
  if (memberError) throw new Error(`PUSH_RECIPIENTS_FAILED:${memberError.message}`);
  const recipientIds = (members || []).map((member) => member.user_id);
  if (!recipientIds.length) return { configured: true, sent: 0 };
  const { data, error } = await client.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth").eq("workspace_id", update.workspace_id).in("user_id", recipientIds);
  if (error) throw new Error(`PUSH_SUBSCRIPTIONS_FAILED:${error.message}`);
  const payload = { title: "Novo update no AXION Office", body: `${input.authorName} publicou um novo update.`, icon: "/icon-192.png", badge: "/icon-192.png", url: `/?update=${encodeURIComponent(input.updateId)}`, tag: teamUpdatePushEventKey(input.updateId), updateId: input.updateId };
  const results = await Promise.all((data as PushRow[] || []).map((subscription) => deliver(client, vapid, teamUpdatePushEventKey(input.updateId), subscription, payload)));
  return { configured: true, sent: results.filter((result) => result === "sent").length, expired: results.filter((result) => result === "expired").length, failed: results.filter((result) => result === "failed").length };
}

export async function sendTestPush(client: SupabaseClient, userId: string, rawDeviceId: unknown) {
  const vapid = getVapidConfig();
  if (!vapid) throw new Error("PUSH_NOT_CONFIGURED");
  const deviceId = validatePushDeviceId(rawDeviceId);
  const { data, error } = await client.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth").eq("user_id", userId).eq("device_id", deviceId).single();
  if (error || !data) throw new Error("PUSH_SUBSCRIPTION_NOT_FOUND");
  const minute = Math.floor(Date.now() / 60_000);
  const result = await deliver(client, vapid, `test:${userId}:${deviceId}:${minute}`, data as PushRow, { title: "AXION Office", body: "As notificações estão ativas neste dispositivo.", icon: "/icon-192.png", badge: "/icon-192.png", url: "/?notifications=1", tag: `test-${minute}` });
  if (result === "failed" || result === "expired") throw new Error(result === "expired" ? "PUSH_SUBSCRIPTION_EXPIRED" : "PUSH_TEST_FAILED");
  return { sent: result === "sent", duplicate: result === "duplicate" };
}
