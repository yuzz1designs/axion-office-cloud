import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { getSupabaseBackend } from "./supabaseBackend";
import type { OAuthGrant } from "./googleOAuthCore";
import type { WorkspaceGrant, WorkspaceProfileState } from "./googleWorkspaceStore";

function backend() {
  const value = getSupabaseBackend();
  if (!value) throw new Error("SUPABASE_NOT_CONFIGURED");
  return value.client;
}
export function integrationEncryptionConfigured() {
  return Buffer.from(process.env.AXION_INTEGRATION_KEY || "", "base64").length === 32;
}
function key() {
  if (!integrationEncryptionConfigured()) throw new Error("INTEGRATION_ENCRYPTION_NOT_CONFIGURED");
  return Buffer.from(process.env.AXION_INTEGRATION_KEY!, "base64");
}
export function encryptIntegration(value: unknown, identity: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  cipher.setAAD(Buffer.from(identity));
  const encrypted = Buffer.concat([cipher.update(Buffer.from(JSON.stringify(value), "utf8")), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}
export function decryptIntegration<T>(value: string, identity: string): T {
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !encrypted) throw new Error("INTEGRATION_DATA_INVALID");
  const cipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  cipher.setAAD(Buffer.from(identity));
  cipher.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(encrypted, "base64url")), cipher.final()]).toString());
}
class IntegrationStore<T> {
  constructor(private readonly provider: string) {}
  async read(userId: string): Promise<T | null> {
    const { data, error } = await backend().from("integration_accounts").select("encrypted_refresh_token,status").eq("user_id", userId).eq("provider", this.provider).maybeSingle();
    if (error) throw new Error("INTEGRATION_READ_FAILED");
    return data?.status === "connected" && data.encrypted_refresh_token ? decryptIntegration<T>(data.encrypted_refresh_token, `${this.provider}:${userId}`) : null;
  }
  async write(userId: string, value: T, grant: OAuthGrant) {
    const client = backend();
    const { data: member, error: memberError } = await client.from("workspace_members").select("workspace_id").eq("user_id", userId).eq("status", "active").single();
    if (memberError || !member) throw new Error("INTEGRATION_MEMBERSHIP_REQUIRED");
    const { error } = await client.from("integration_accounts").upsert({ user_id: userId, workspace_id: member.workspace_id, provider: this.provider, provider_email: grant.email, scopes: grant.scopes, status: "connected", encrypted_refresh_token: encryptIntegration(value, `${this.provider}:${userId}`), updated_at: new Date().toISOString() }, { onConflict: "user_id,provider" });
    if (error) throw new Error("INTEGRATION_WRITE_FAILED");
  }
  async clear(userId: string) {
    const { error } = await backend().from("integration_accounts").update({ status: "revoked", encrypted_refresh_token: "", updated_at: new Date().toISOString() }).eq("user_id", userId).eq("provider", this.provider);
    if (error) throw new Error("INTEGRATION_REVOKE_FAILED");
  }
}
export class CloudDriveStore {
  private store = new IntegrationStore<OAuthGrant>("google_drive");
  read(userId: string) { return this.store.read(userId); }
  write(userId: string, grant: OAuthGrant) { return this.store.write(userId, grant, grant); }
  clear(userId: string) { return this.store.clear(userId); }
}
export class CloudWorkspaceStore {
  private store = new IntegrationStore<WorkspaceProfileState>("google_calendar_tasks");
  read(userId: string) { return this.store.read(userId); }
  async writeGrant(userId: string, grant: WorkspaceGrant) {
    const previous = await this.read(userId);
    // A different Google account must never inherit the previous account's IDs/cache.
    const sameAccount = previous?.grant.email === grant.email;
    await this.store.write(userId, { ...(sameAccount ? previous : {}), grant, events: sameAccount ? previous.events : [], tasks: sameAccount ? previous.tasks : [], focus: sameAccount ? previous.focus : { totalMinutes: 0, completedTaskMinutes: {} } }, grant);
  }
  async update(userId: string, patch: Partial<Omit<WorkspaceProfileState, "grant">>) {
    const value = await this.read(userId);
    if (!value) throw new Error("GOOGLE_WORKSPACE_NOT_CONNECTED");
    await this.store.write(userId, { ...value, ...patch }, value.grant);
  }
  clear(userId: string) { return this.store.clear(userId); }
}
export class CloudOAuthStates {
  constructor(private readonly provider: string) {}
  async create(userId: string) {
    const state = randomBytes(32).toString("base64url");
    const { error } = await backend().from("oauth_pending_states").insert({ state_hash: createHash("sha256").update(state).digest("hex"), user_id: userId, provider: this.provider, expires_at: new Date(Date.now() + 300_000).toISOString() });
    if (error) throw new Error(`OAUTH_STATE_WRITE_FAILED:${error.message}`);
    return state;
  }
  async consume(state: string) {
    if (!state || state.length > 200) return null;
    const { data, error } = await backend().from("oauth_pending_states").delete().eq("state_hash", createHash("sha256").update(state).digest("hex")).eq("provider", this.provider).gt("expires_at", new Date().toISOString()).select("user_id").maybeSingle();
    if (error) throw new Error(`OAUTH_STATE_READ_FAILED:${error.message}`);
    return data?.user_id || null;
  }
}
