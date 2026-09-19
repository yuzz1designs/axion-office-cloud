export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
type FetchImplementation = typeof fetch;
export interface GmailQuoteCandidate { messageId: string; threadId: string; receivedAt: string; from: string; subject: string; body: string; }
function decode(value = "") { try { return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"); } catch { return ""; } }
function partText(part: any): string { if (part?.mimeType === "text/plain" && part.body?.data) return decode(part.body.data); return (part?.parts || []).map(partText).filter(Boolean).join("\n"); }
export class GmailQuotesClient {
  constructor(private readonly accessToken: string, private readonly fetchImpl: FetchImplementation = (input, init) => globalThis.fetch(input, init)) {}
  private async request<T>(url: string) { const response = await this.fetchImpl(url, { headers: { Authorization: `Bearer ${this.accessToken}` } }); const result = await response.json().catch(() => ({})) as T & { error?: { message?: string } }; if (!response.ok) throw new Error(`GMAIL_REQUEST_FAILED:${result.error?.message || response.status}`); return result; }
  async listCandidates(after?: string) { const query = ["in:inbox", "-from:me", "-category:promotions", "-category:social", after ? `after:${Math.floor(new Date(after).getTime() / 1000)}` : "newer_than:90d"].join(" "); const list = await this.request<{ messages?: Array<{ id: string }> }>(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent(query)}`); const messages: GmailQuoteCandidate[] = []; for (const entry of list.messages || []) { const raw = await this.request<any>(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(entry.id)}?format=full`); const headers = new Map<string,string>((raw.payload?.headers || []).map((header: any) => [String(header.name).toLowerCase(), String(header.value)])); messages.push({ messageId: raw.id, threadId: raw.threadId, receivedAt: new Date(Number(raw.internalDate)).toISOString(), from: headers.get("from") || "", subject: headers.get("subject") || "(sem assunto)", body: partText(raw.payload) || decode(raw.payload?.body?.data) }); } return messages; }
}
export function classifyGmailQuoteCandidate(message: GmailQuoteCandidate) {
  const from = message.from.toLowerCase();
  const plainBody = message.body.replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const content = `${message.subject}\n${plainBody}`.toLowerCase();
  const newsletterSignals = /no-?reply|newsletter|mailchimp|notification|digest|unsubscribe|cancelar subscri[çc][aã]o|manage (?:email )?preferences|view (?:this email )?in (?:your )?browser|email preferences/;
  if (newsletterSignals.test(`${from}\n${content}`)) return null;
  const explicitCommercialIntent = /(pedido de or[çc]amento|pedir (?:um )?or[çc]amento|solicitar (?:um )?or[çc]amento|proposta comercial|pedido de proposta|quanto custa|qual (?:é )?o pre[çc]o|budget dispon[ií]vel|request (?:a )?quote|pricing request)/;
  const requestLanguage = /(precisamos|necessitamos|gostaria|queremos|procuramos|estamos interessados|podem enviar|podes enviar|pretendo|preciso|need|looking for|interested in)/;
  const serviceIntent = /(website|branding|identidade visual|marketing|seo|campanha|crm|automa[çc][aã]o|aplica[çc][aã]o)/;
  if (!explicitCommercialIntent.test(content) && !(requestLanguage.test(content) && serviceIntent.test(content))) return null;
  const email = /<([^>]+@[^>]+)>/.exec(message.from)?.[1] || /([\w.+-]+@[\w.-]+\.[a-z]{2,})/i.exec(message.from)?.[1] || "";
  const contact = message.from.replace(/<[^>]+>/, "").replace(/["']/g, "").trim();
  return { companyName: contact || email.split("@")[1]?.split(".")[0] || "Contacto Gmail", contactName: contact, contactEmail: email.toLowerCase(), subject: message.subject, requestSummary: plainBody.slice(0, 1200) || message.subject, classificationConfidence: 0.8 };
}
