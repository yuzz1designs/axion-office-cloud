export interface SupabaseServerConfig {
  url: string;
  serviceRoleKey: string;
}

type Environment = Record<string, string | undefined>;
const AXION_PARTNER_EMAILS = ["nelsonafonsoprofissional@gmail.com", "eduardo04ssousa@gmail.com", "joaotpsilva.pro@gmail.com"];

export function getSupabaseServerConfig(environment: Environment = process.env): SupabaseServerConfig | null {
  const url = environment.SUPABASE_URL?.trim();
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return url && serviceRoleKey ? { url, serviceRoleKey } : null;
}

export function getAllowedEmails(environment: Environment = process.env): string[] {
  const configured = environment.AXION_ALLOWED_EMAILS || "";
  return [...new Set([...AXION_PARTNER_EMAILS, ...configured.split(",")].map((email) => email.trim().toLowerCase()).filter(Boolean))];
}

export function isAllowedEmail(email: string, allowlist = getAllowedEmails()) {
  return allowlist.includes(email.trim().toLowerCase());
}
