import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appendClientDocument, nextClientReference, normalizeClientInput, validateClientLogo, type ClientProfileData } from "./clientCore";

type Row = Record<string, any>;

export class ClientStore {
  constructor(private readonly client: SupabaseClient) {}

  private async workspaceId(userId: string) {
    const { data, error } = await this.client.from("workspace_members").select("workspace_id").eq("user_id", userId).eq("status", "active").single();
    if (error || !data) throw new Error("CLIENT_WORKSPACE_NOT_FOUND");
    return data.workspace_id as string;
  }

  private fromRow(row: Row) {
    const logoUrl = row.logo_path ? this.client.storage.from("client-logos").getPublicUrl(row.logo_path).data.publicUrl : "";
    return { ...(row.profile_data || {}), id: row.id, reference: row.external_ref, name: row.company, website: row.website || "", industry: row.sector || "", headquarters: [row.city, row.country].filter(Boolean).join(", "), logoUrl };
  }

  async list(userId: string) {
    const workspaceId = await this.workspaceId(userId);
    const { data, error } = await this.client.from("clients").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
    if (error) throw new Error(`CLIENT_READ_FAILED:${error.message}`);
    return (data || []).map((row) => this.fromRow(row));
  }

  async create(userId: string, raw: Record<string, unknown>) {
    const workspaceId = await this.workspaceId(userId);
    const input = normalizeClientInput(raw);
    const { data: references, error: referenceError } = await this.client.from("clients").select("external_ref").eq("workspace_id", workspaceId);
    if (referenceError) throw new Error(`CLIENT_REFERENCE_FAILED:${referenceError.message}`);
    const reference = nextClientReference((references || []).map((item) => item.external_ref));
    const { data, error } = await this.client.from("clients").insert(this.toRow(workspaceId, reference, input, userId)).select("*").single();
    if (error || !data) throw new Error(`CLIENT_CREATE_FAILED:${error?.message}`);
    return this.fromRow(data);
  }

  async update(userId: string, clientId: string, raw: Record<string, unknown>) {
    const workspaceId = await this.workspaceId(userId);
    const input = normalizeClientInput(raw);
    const reference = String(input.reference || "");
    const { data, error } = await this.client.from("clients").update(this.toRow(workspaceId, reference, input, userId)).eq("id", clientId).eq("workspace_id", workspaceId).select("*").single();
    if (error || !data) throw new Error(`CLIENT_UPDATE_FAILED:${error?.message}`);
    return this.fromRow(data);
  }

  async remove(userId: string, clientId: string) {
    const workspaceId = await this.workspaceId(userId);
    const { data } = await this.client.from("clients").select("logo_path").eq("id", clientId).eq("workspace_id", workspaceId).maybeSingle();
    const { error } = await this.client.from("clients").delete().eq("id", clientId).eq("workspace_id", workspaceId);
    if (error) throw new Error(`CLIENT_DELETE_FAILED:${error.message}`);
    if (data?.logo_path) await this.client.storage.from("client-logos").remove([data.logo_path]).catch(() => undefined);
  }

  async uploadLogo(userId: string, clientId: string, contentType: string, body: Buffer) {
    const workspaceId = await this.workspaceId(userId);
    const extension = validateClientLogo(contentType, body.length);
    const { data: current, error: currentError } = await this.client.from("clients").select("logo_path").eq("id", clientId).eq("workspace_id", workspaceId).single();
    if (currentError || !current) throw new Error("CLIENT_NOT_FOUND");
    const path = `${workspaceId}/${clientId}/${randomUUID()}.${extension}`;
    const { error: uploadError } = await this.client.storage.from("client-logos").upload(path, body, { contentType, upsert: false });
    if (uploadError) throw new Error(`CLIENT_LOGO_UPLOAD_FAILED:${uploadError.message}`);
    const { data, error } = await this.client.from("clients").update({ logo_path: path, updated_at: new Date().toISOString() }).eq("id", clientId).eq("workspace_id", workspaceId).select("*").single();
    if (error || !data) { await this.client.storage.from("client-logos").remove([path]); throw new Error(`CLIENT_LOGO_UPDATE_FAILED:${error?.message}`); }
    if (current.logo_path) await this.client.storage.from("client-logos").remove([current.logo_path]).catch(() => undefined);
    return this.fromRow(data);
  }

  async attachDocument(userId: string, clientId: string, document: { id: string; name: string; extension: string; sizeLabel: string; webViewLink: string }) {
    const workspaceId = await this.workspaceId(userId);
    const { data, error } = await this.client.from("clients").select("*").eq("id", clientId).eq("workspace_id", workspaceId).single();
    if (error || !data) throw new Error("CLIENT_NOT_FOUND");
    const current = this.fromRow(data);
    return this.update(userId, clientId, {
      ...current,
      associatedDocs: appendClientDocument(current.associatedDocs || [], document),
    });
  }

  private toRow(workspaceId: string, reference: string, input: ClientProfileData, userId: string) {
    const city = String(input.headquarters || "").split(",")[0]?.trim() || "";
    const country = String(input.headquarters || "").split(",").slice(1).join(",").trim();
    const owner = String(input.accountManager || "");
    return { workspace_id: workspaceId, external_ref: reference, company: input.name, website: String(input.website || ""), sector: String(input.industry || ""), city, country, owner_user_id: userId, owner_label: owner, lead_status: String(input.status || ""), estimated_monthly_value: String(input.mrrValue || ""), notes: String(input.executiveSummary || ""), profile_data: { ...input, id: undefined, logoUrl: undefined }, updated_at: new Date().toISOString() };
  }
}
