export interface BrowserPushSubscriptionInput {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

export const PUSH_DEVICE_ID_PATTERN = /^[a-zA-Z0-9._:-]{8,160}$/;

export function normalizePushSubscription(raw: unknown): BrowserPushSubscriptionInput {
  const value = raw && typeof raw === "object" ? raw as Record<string, any> : {};
  const endpoint = typeof value.endpoint === "string" ? value.endpoint.trim() : "";
  const keys = value.keys && typeof value.keys === "object" ? value.keys as Record<string, unknown> : {};
  const p256dh = typeof keys.p256dh === "string" ? keys.p256dh.trim() : "";
  const auth = typeof keys.auth === "string" ? keys.auth.trim() : "";
  if (!endpoint.startsWith("https://") || endpoint.length > 4096 || p256dh.length < 20 || p256dh.length > 512 || auth.length < 8 || auth.length > 256) throw new Error("PUSH_SUBSCRIPTION_INVALID");
  return { endpoint, expirationTime: typeof value.expirationTime === "number" ? value.expirationTime : null, keys: { p256dh, auth } };
}

export function validatePushDeviceId(value: unknown) {
  const deviceId = typeof value === "string" ? value.trim() : "";
  if (!PUSH_DEVICE_ID_PATTERN.test(deviceId)) throw new Error("PUSH_DEVICE_INVALID");
  return deviceId;
}

export function teamUpdatePushEventKey(updateId: string) {
  return `team-update:${updateId}`;
}

export function isExpiredPushStatus(statusCode: number | undefined) {
  return statusCode === 404 || statusCode === 410;
}
