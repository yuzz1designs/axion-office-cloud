const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleOAuthTokens {
  accessToken: string;
  refreshToken: string;
  scopes: string[];
}

type FetchImplementation = typeof fetch;

export class GoogleOAuthClient {
  constructor(private readonly config: GoogleOAuthConfig, private readonly fetchImpl: FetchImplementation = fetch) {}

  private async requestToken(parameters: Record<string, string>) {
    const response = await this.fetchImpl(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        ...parameters,
      }),
    });
    const result = await response.json() as {
      access_token?: string;
      refresh_token?: string;
      scope?: string;
      error?: string;
    };
    if (!response.ok || !result.access_token) throw new Error(`GOOGLE_OAUTH_TOKEN_FAILED:${result.error || response.status}`);
    return result;
  }

  async exchangeAuthorizationCode(code: string): Promise<GoogleOAuthTokens> {
    const result = await this.requestToken({
      code,
      grant_type: "authorization_code",
      redirect_uri: this.config.redirectUri,
    });
    if (!result.refresh_token) throw new Error("GOOGLE_OAUTH_REFRESH_TOKEN_MISSING");
    return {
      accessToken: result.access_token!,
      refreshToken: result.refresh_token,
      scopes: (result.scope || "").split(/\s+/).filter(Boolean),
    };
  }

  async refreshAccessToken(refreshToken: string) {
    const result = await this.requestToken({ refresh_token: refreshToken, grant_type: "refresh_token" });
    return result.access_token!;
  }

  async getUserEmail(accessToken: string) {
    const response = await this.fetchImpl(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
    const result = await response.json() as { email?: string; email_verified?: boolean };
    if (!response.ok || !result.email || result.email_verified !== true) throw new Error("GOOGLE_OAUTH_EMAIL_UNVERIFIED");
    return result.email;
  }

  async revokeGrant(refreshToken: string) {
    const response = await this.fetchImpl(REVOKE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshToken }),
    });
    return response.ok;
  }
}
