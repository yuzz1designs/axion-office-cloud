import type { SupabaseClient } from "@supabase/supabase-js";

export interface DiscordIdentity {
  userId: string;
  name: string;
  email: string;
}

export interface DiscordIdentitySource {
  findAxionUserId(discordUserId: string): Promise<string | null>;
  findProfile(userId: string): Promise<DiscordIdentity | null>;
}

export class SupabaseDiscordIdentitySource implements DiscordIdentitySource {
  constructor(private readonly client: SupabaseClient) {}

  async findAxionUserId(discordUserId: string) {
    const { data, error } = await this.client.from("integration_accounts")
      .select("user_id").eq("provider", "discord").eq("external_user_id", discordUserId)
      .eq("status", "connected").maybeSingle();
    if (error) throw new Error(`DISCORD_IDENTITY_LOOKUP_FAILED:${error.message}`);
    return data?.user_id ? String(data.user_id) : null;
  }

  async findProfile(userId: string) {
    const { data, error } = await this.client.from("profiles")
      .select("user_id,preferred_name,display_name,email").eq("user_id", userId).maybeSingle();
    if (error) throw new Error(`DISCORD_PROFILE_LOOKUP_FAILED:${error.message}`);
    if (!data) return null;
    return { userId: String(data.user_id), name: data.preferred_name || data.display_name || data.email, email: data.email };
  }
}

export async function resolveDiscordIdentity(source: DiscordIdentitySource, discordUserId: string) {
  const userId = await source.findAxionUserId(discordUserId);
  return userId ? source.findProfile(userId) : null;
}

export async function getOwnDiscordIntegration(client: SupabaseClient, userId: string) {
  const { data, error } = await client.from("integration_accounts")
    .select("external_user_id,external_display_name,created_at,updated_at,status")
    .eq("user_id", userId).eq("provider", "discord").maybeSingle();
  if (error) throw new Error(`DISCORD_INTEGRATION_READ_FAILED:${error.message}`);
  return data ? {
    discordUserId: data.external_user_id || "", displayName: data.external_display_name || "",
    createdAt: data.created_at, updatedAt: data.updated_at, connected: data.status === "connected",
  } : null;
}

export async function saveOwnDiscordIntegration(client: SupabaseClient, userId: string, discordUserId: string, displayName: string) {
  const { data: membership, error: membershipError } = await client.from("workspace_members")
    .select("workspace_id").eq("user_id", userId).eq("status", "active").single();
  if (membershipError || !membership) throw new Error("DISCORD_WORKSPACE_NOT_FOUND");
  const now = new Date().toISOString();
  const { error } = await client.from("integration_accounts").upsert({
    workspace_id: membership.workspace_id, user_id: userId, provider: "discord",
    provider_email: displayName || `discord:${discordUserId}`, encrypted_refresh_token: "",
    external_user_id: discordUserId, external_display_name: displayName, status: "connected", updated_at: now,
  }, { onConflict: "user_id,provider" });
  if (error) {
    if (error.code === "23505") throw new Error("DISCORD_USER_ALREADY_LINKED");
    throw new Error(`DISCORD_INTEGRATION_SAVE_FAILED:${error.message}`);
  }
  return getOwnDiscordIntegration(client, userId);
}
