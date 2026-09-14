import { randomBytes } from "node:crypto";
import type { AxionProfile, ProfileDevice } from "../types/profile";

export type UserProfile = AxionProfile;
export type { ProfileDevice };

export function detectDevice(_input: { id: string; userAgent?: string; ipAddress?: string }, _now = new Date()): ProfileDevice {
  const userAgent = _input.userAgent || "";
  const operatingSystem = /iPad/i.test(userAgent) ? "iPadOS"
    : /iPhone/i.test(userAgent) ? "iOS"
    : /Android/i.test(userAgent) ? "Android"
    : /Macintosh|Mac OS X/i.test(userAgent) ? "macOS"
    : /Windows/i.test(userAgent) ? "Windows"
    : /Linux/i.test(userAgent) ? "Linux"
    : "Sistema desconhecido";
  const browser = /Edg\//i.test(userAgent) ? "Edge"
    : /Chrome\//i.test(userAgent) ? "Chrome"
    : /Firefox\//i.test(userAgent) ? "Firefox"
    : /Safari\//i.test(userAgent) ? "Safari"
    : "Browser desconhecido";
  const deviceName = operatingSystem === "macOS" ? "Mac" : operatingSystem;
  const timestamp = _now.toISOString();
  return {
    id: _input.id,
    name: `${deviceName} · ${browser}`,
    browser,
    operatingSystem,
    ipAddress: _input.ipAddress || "Local",
    firstSeenAt: timestamp,
    lastSeenAt: timestamp,
  };
}

export function attachDevice(profile: UserProfile, device: ProfileDevice): UserProfile {
  const devices = profile.devices ?? [];
  const previous = devices.find((item) => item.id === device.id);
  const updated = previous ? { ...device, firstSeenAt: previous.firstSeenAt } : device;
  return { ...profile, devices: [...devices.filter((item) => item.id !== device.id), updated] };
}

export function generateAxKey() {
  return `AX-${randomBytes(3).toString("hex").toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export function createProfile(input: Partial<UserProfile>, axKeyFactory = generateAxKey, now = new Date()): UserProfile {
  const timestamp = now.toISOString();
  const email = String(input.email ?? "").trim().toLowerCase();
  const name = String(input.name ?? "").trim();
  const initials = String(input.initials ?? (name.slice(0, 2) || email.slice(0, 2) || "AX")).trim().slice(0, 4).toUpperCase();
  return {
    id: input.id || randomBytes(16).toString("base64url"),
    email,
    name,
    displayName: String(input.displayName ?? name.split(" ")[0] ?? "").trim(),
    role: String(input.role ?? "").trim(),
    department: String(input.department ?? "").trim(),
    phone: String(input.phone ?? "").trim(),
    deskLocation: String(input.deskLocation ?? "").trim(),
    timezone: String(input.timezone ?? "Europe/Lisbon").trim(),
    bio: String(input.bio ?? "").trim(),
    avatarUrl: String(input.avatarUrl ?? "").trim(),
    initials,
    accentColor: String(input.accentColor ?? "amber").trim() || "amber",
    axKey: input.axKey || axKeyFactory(),
    focusMinutes: 0,
    devices: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function profileNeedsSetup(profile: UserProfile | null) {
  return !profile?.name.trim() || !profile.role.trim() || !profile.email.trim();
}

export function sanitizeProfileInput(profile: UserProfile, input: Partial<UserProfile>, now = new Date()): UserProfile {
  const name = String(input.name ?? profile.name).trim();
  const role = String(input.role ?? profile.role).trim();
  const displayName = String(input.displayName ?? profile.displayName ?? name.split(" ")[0] ?? "").trim();
  const department = String(input.department ?? profile.department ?? "").trim();
  const phone = String(input.phone ?? profile.phone).trim();
  const deskLocation = String(input.deskLocation ?? profile.deskLocation ?? "").trim();
  const timezone = String(input.timezone ?? profile.timezone ?? "Europe/Lisbon").trim();
  const bio = String(input.bio ?? profile.bio ?? "").trim();
  const email = String(input.email ?? profile.email).trim().toLowerCase();
  const avatarUrl = String(input.avatarUrl ?? profile.avatarUrl).trim();
  const initials = String(input.initials ?? profile.initials).trim().slice(0, 4).toUpperCase() || profile.initials;
  const accentColor = String(input.accentColor ?? profile.accentColor).trim() || profile.accentColor;
  return { ...profile, email, name, displayName, role, department, phone, deskLocation, timezone, bio, avatarUrl, initials, accentColor, focusMinutes: profile.focusMinutes ?? 0, devices: profile.devices ?? [], updatedAt: now.toISOString() };
}
