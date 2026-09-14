import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseServerConfig } from "./supabaseConfig";
import { SupabaseProfileStore } from "./supabaseProfileStore";

interface BackendIdentity { url: string; serviceRoleKey: string }

let cached: (BackendIdentity & { client: SupabaseClient; profiles: SupabaseProfileStore }) | null = null;

export function canReuseSupabaseBackend(previous: BackendIdentity, current: BackendIdentity) {
  return previous.url === current.url && previous.serviceRoleKey === current.serviceRoleKey;
}

export function getSupabaseBackend() {
  const config = getSupabaseServerConfig();
  if (!config) return null;
  if (cached && canReuseSupabaseBackend(cached, config)) return cached;
  const client = createClient(config.url, config.serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  cached = { ...config, client, profiles: new SupabaseProfileStore(config, client) };
  return cached;
}
