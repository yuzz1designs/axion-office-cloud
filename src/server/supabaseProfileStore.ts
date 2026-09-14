import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { UserProfile } from "./authCore";
import type { SupabaseServerConfig } from "./supabaseConfig";

type ProfileRow = Record<string, any>;

export function profileFromSupabase(row: ProfileRow): UserProfile {
  return {
    id: row.user_id,
    email: row.email || "",
    name: row.display_name || "",
    displayName: row.preferred_name || String(row.display_name || "").split(" ")[0] || "",
    role: row.job_title || "",
    department: row.department || "",
    phone: row.phone || "",
    deskLocation: row.desk_location || "",
    timezone: row.timezone || "Europe/Lisbon",
    bio: row.bio || "",
    avatarUrl: row.avatar_path || "",
    initials: row.initials || "",
    accentColor: row.accent_color || "amber",
    axKey: row.ax_key,
    focusMinutes: row.focus_minutes || 0,
    devices: (row.user_devices || []).filter((device: ProfileRow) => !device.revoked_at).map((device: ProfileRow) => ({
      id: device.device_id_hash,
      name: device.label,
      browser: device.browser || "",
      operatingSystem: device.operating_system || "",
      ipAddress: device.ip_address || "",
      firstSeenAt: device.first_seen_at,
      lastSeenAt: device.last_seen_at,
    })),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseProfileStore {
  private readonly client: SupabaseClient;

  constructor(config: SupabaseServerConfig, client?: SupabaseClient) {
    this.client = client || createClient(config.url, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async findById(userId: string): Promise<UserProfile | null> {
    if (!userId) return null;
    const { data, error } = await this.client.from("profiles").select("*, user_devices(*)").eq("user_id", userId).maybeSingle();
    if (error) throw new Error(`SUPABASE_PROFILE_READ_FAILED:${error.message}`);
    return data ? profileFromSupabase(data) : null;
  }

  async upsert(profile: UserProfile): Promise<UserProfile> {
    const { data: current, error: currentError } = await this.client.from("profiles").select("workspace_id").eq("user_id", profile.id).single();
    if (currentError) throw new Error(`SUPABASE_PROFILE_WORKSPACE_FAILED:${currentError.message}`);
    const { error } = await this.client.from("profiles").upsert({
      user_id: profile.id,
      workspace_id: current.workspace_id,
      email: profile.email,
      display_name: profile.name,
      preferred_name: profile.displayName,
      job_title: profile.role,
      department: profile.department,
      phone: profile.phone,
      desk_location: profile.deskLocation,
      timezone: profile.timezone,
      bio: profile.bio,
      avatar_path: profile.avatarUrl,
      initials: profile.initials,
      accent_color: profile.accentColor,
      focus_minutes: profile.focusMinutes,
      ax_key: profile.axKey,
      updated_at: profile.updatedAt,
    }, { onConflict: "user_id" });
    if (error) throw new Error(`SUPABASE_PROFILE_WRITE_FAILED:${error.message}`);
    return (await this.findById(profile.id))!;
  }

  async upsertDevice(userId: string, device: UserProfile["devices"][number]) {
    const { error } = await this.client.from("user_devices").upsert({
      user_id: userId,
      device_id_hash: device.id,
      label: device.name,
      browser: device.browser,
      operating_system: device.operatingSystem,
      ip_address: device.ipAddress === "Local" ? null : device.ipAddress,
      first_seen_at: device.firstSeenAt,
      last_seen_at: device.lastSeenAt,
    }, { onConflict: "user_id,device_id_hash" });
    if (error) throw new Error(`SUPABASE_DEVICE_WRITE_FAILED:${error.message}`);
  }
}
