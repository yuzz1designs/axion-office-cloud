export const PRESENCE_TTL_MS = 120_000;

export interface OfficeMemberPresence {
  userId: string;
  name: string;
  startedAt: string | null;
  lastSeenAt: string | null;
}

export interface OfficePresenceSnapshot {
  members: OfficeMemberPresence[];
  serverTime: string;
}

export function isOfficeMemberOnline(member: OfficeMemberPresence, now: number) {
  if (!member.startedAt || !member.lastSeenAt) return false;
  const seen = Date.parse(member.lastSeenAt);
  return Number.isFinite(seen) && now - seen <= PRESENCE_TTL_MS;
}

export function officeSessionTime(member: OfficeMemberPresence, now: number) {
  if (!isOfficeMemberOnline(member, now)) return null;
  const seconds = Math.max(0, Math.floor((now - Date.parse(member.startedAt!)) / 1000));
  if (!Number.isFinite(seconds)) return null;
  return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60]
    .map((part) => String(part).padStart(2, "0")).join(":");
}
