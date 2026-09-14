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
  const user = data.user;
  const email = user?.email?.trim().toLowerCase() || "";
  const provider = user?.app_metadata?.provider;
  if (error || !user || provider !== "google" || !allowedEmails.includes(email)) return null;
  return { id: user.id, email };
}
