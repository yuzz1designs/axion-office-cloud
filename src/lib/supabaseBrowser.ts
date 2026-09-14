import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SupabasePublicConfig {
  configured: boolean;
  url?: string;
  publishableKey?: string;
}

let client: SupabaseClient | null = null;

export function hasSupabaseOAuthReturn(url: string) {
  const parsed = new URL(url);
  return parsed.searchParams.has("code") || parsed.searchParams.has("error") || parsed.hash.includes("access_token=");
}

export function isAxionDesktop(url: string) {
  return new URL(url).searchParams.get("axion-desktop") === "1";
}

export function getDesktopOAuthReturnState(url: string) {
  return new URL(url).searchParams.get("axion-desktop-return");
}

export function extractOAuthTokens(url: string) {
  const hash = new URL(url).hash.replace(/^#/, "");
  const params = new URLSearchParams(hash);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

export function shouldEnterAfterOAuth(isOAuthReturn: boolean, sessionBridged: boolean) {
  return isOAuthReturn && sessionBridged;
}

export function getSupabaseBrowserClient(config: SupabasePublicConfig) {
  if (!config.configured || !config.url || !config.publishableKey) return null;
  if (!client) client = createClient(config.url, config.publishableKey, { auth: { flowType: "implicit", detectSessionInUrl: true, persistSession: true } });
  return client;
}

export async function bridgeSupabaseSession(config: SupabasePublicConfig, callbackUrl = window.location.href) {
  const supabase = getSupabaseBrowserClient(config);
  if (!supabase) return false;
  let { data } = await supabase.auth.getSession();
  const callbackTokens = extractOAuthTokens(callbackUrl);
  if (!data.session?.access_token && callbackTokens) {
    const established = await supabase.auth.setSession({ access_token: callbackTokens.accessToken, refresh_token: callbackTokens.refreshToken });
    if (established.error) return false;
    data = { session: established.data.session };
  }
  const code = new URL(callbackUrl).searchParams.get("code");
  if (!data.session?.access_token && code) {
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    if (exchanged.error) return false;
    data = { session: exchanged.data.session };
  }
  if (!data.session?.access_token) return false;
  const response = await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken: data.session.access_token }),
  });
  return response.ok;
}

async function resolveSupabaseSession(config: SupabasePublicConfig, callbackUrl: string) {
  const supabase = getSupabaseBrowserClient(config);
  if (!supabase) return null;
  let { data } = await supabase.auth.getSession();
  const callbackTokens = extractOAuthTokens(callbackUrl);
  if (!data.session?.access_token && callbackTokens) {
    const established = await supabase.auth.setSession({ access_token: callbackTokens.accessToken, refresh_token: callbackTokens.refreshToken });
    if (established.error) return null;
    data = { session: established.data.session };
  }
  const code = new URL(callbackUrl).searchParams.get("code");
  if (!data.session?.access_token && code) {
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    if (exchanged.error) return null;
    data = { session: exchanged.data.session };
  }
  return data.session;
}

export async function completeDesktopOAuthHandoff(config: SupabasePublicConfig, callbackUrl: string, requestedState?: string) {
  const state = requestedState || getDesktopOAuthReturnState(callbackUrl);
  if (!state) return false;
  const callback = new URL(callbackUrl);
  const oauthError = callback.searchParams.get("error") || callback.searchParams.get("error_description");
  if (oauthError) {
    await fetch("/api/auth/desktop/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state, error: oauthError }),
    });
    return false;
  }
  const session = await resolveSupabaseSession(config, callbackUrl);
  if (!session?.access_token || !session.refresh_token) return false;
  const response = await fetch("/api/auth/desktop/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state, accessToken: session.access_token, refreshToken: session.refresh_token }),
  });
  return response.ok;
}

export async function consumeDesktopOAuthHandoff(config: SupabasePublicConfig, state: string) {
  const response = await fetch(`/api/auth/desktop/result?state=${encodeURIComponent(state)}`);
  if (response.status === 202) return false;
  const result = await response.json() as { ok?: boolean; accessToken?: string; refreshToken?: string; error?: string };
  if (!response.ok || !result.ok || !result.accessToken || !result.refreshToken) throw new Error(result.error || "Não foi possível concluir o login desktop.");
  const supabase = getSupabaseBrowserClient(config);
  if (!supabase) throw new Error("Supabase não está configurado.");
  const established = await supabase.auth.setSession({ access_token: result.accessToken, refresh_token: result.refreshToken });
  if (established.error) throw established.error;
  const bridged = await bridgeSupabaseSession(config);
  if (!bridged) throw new Error("A sessão desktop não foi aceite pelo AXION.");
  return true;
}

export async function signOutAxionSession(config: SupabasePublicConfig) {
  const supabase = getSupabaseBrowserClient(config);
  if (supabase) await supabase.auth.signOut({ scope: "local" });
  await fetch("/api/auth/session", { method: "DELETE" });
}

export function subscribeSupabaseSession(config: SupabasePublicConfig, onSessionChanged: () => void) {
  const supabase = getSupabaseBrowserClient(config);
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!session?.access_token) return;
    void fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accessToken: session.access_token }),
    }).then((response) => response.ok && onSessionChanged());
  });
  return () => data.subscription.unsubscribe();
}

export function subscribeAxionRealtime(config: SupabasePublicConfig, onChange: (table: string) => void) {
  const supabase = getSupabaseBrowserClient(config);
  if (!supabase) return () => undefined;
  const channel = supabase.channel("axion-office")
    .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => onChange("profiles"))
    .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => onChange("tasks"))
    .on("postgres_changes", { event: "*", schema: "public", table: "calendar_events" }, () => onChange("calendar_events"))
    .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => onChange("clients"))
    .on("postgres_changes", { event: "*", schema: "public", table: "audit_logs" }, () => onChange("audit_logs"))
    .on("postgres_changes", { event: "*", schema: "public", table: "revenue_entries" }, () => onChange("revenue_entries"))
    .on("postgres_changes", { event: "*", schema: "public", table: "payment_schedules" }, () => onChange("payment_schedules"))
    .on("postgres_changes", { event: "*", schema: "public", table: "payment_transactions" }, () => onChange("payment_transactions"))
    .on("postgres_changes", { event: "*", schema: "public", table: "notification_reads" }, () => onChange("notification_reads"))
    .subscribe();
  return () => { void supabase.removeChannel(channel); };
}
