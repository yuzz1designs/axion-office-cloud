import { randomBytes } from "node:crypto";

export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";
export const GOOGLE_OAUTH_SCOPES = ["openid", "email", GOOGLE_DRIVE_SCOPE] as const;

export interface OAuthGrant {
  refreshToken: string;
  email: string;
  scopes: string[];
  connectedAt: string;
}

export interface PublicOAuthStatus {
  configured: boolean;
  connected: boolean;
  email?: string;
  connectedAt?: string;
  missingScopes: string[];
}

export class OAuthStateStore {
  private readonly states = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now, private readonly ttlMs = 300_000) {}

  create() {
    const state = randomBytes(32).toString("base64url");
    this.states.set(state, this.now() + this.ttlMs);
    return state;
  }

  consume(state: string) {
    const expiry = this.states.get(state);
    this.states.delete(state);
    return Boolean(expiry && expiry >= this.now());
  }
}

export function buildGoogleAuthorizationUrl({ clientId, redirectUri, state }: { clientId: string; redirectUri: string; state: string }) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_OAUTH_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString();
  return url.toString();
}

export function toPublicOAuthStatus({ configured, grant }: { configured: boolean; grant: OAuthGrant | null }): PublicOAuthStatus {
  const missingScopes = grant?.scopes.includes(GOOGLE_DRIVE_SCOPE) ? [] : [GOOGLE_DRIVE_SCOPE];
  return {
    configured,
    connected: Boolean(configured && grant && missingScopes.length === 0),
    ...(grant ? { email: grant.email, connectedAt: grant.connectedAt } : {}),
    missingScopes,
  };
}
