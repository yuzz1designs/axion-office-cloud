export class AuthServiceUnavailable extends Error {
  constructor() { super("AUTH_SERVICE_UNAVAILABLE"); }
}

export interface AuthenticatedAxionUser {
  id: string;
  email: string;
}

interface SupabaseAuthLike {
  getUser(token: string): Promise<{
    data: { user: { id: string; email?: string; app_metadata?: Record<string, any> } | null };
    error: unknown;
  }>;
}

export function readSessionToken(cookie = "") {
  const entry = cookie.split(";").map((part) => part.trim()).find((part) => part.startsWith("axion_session="));
  return entry ? decodeURIComponent(entry.slice("axion_session=".length)) : "";
}

export async function authenticateSupabaseUser(token: string, auth: SupabaseAuthLike, allowedEmails: string[]): Promise<AuthenticatedAxionUser | null> {
  if (!token) return null;
  const { data, error } = await auth.getUser(token);
  if (error) {
    const status = Number((error as { status?: number }).status || 0);
    // A failed upstream request is not proof that the user's session expired.
    if (![400, 401, 403, 422].includes(status)) throw new AuthServiceUnavailable();
    return null;
  }
  const user = data?.user;
  const email = user?.email?.trim().toLowerCase() || "";
  const provider = user?.app_metadata?.provider;
  if (error || !user || provider !== "google" || !allowedEmails.includes(email)) return null;
  return { id: user.id, email };
}
