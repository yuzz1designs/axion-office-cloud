/** Retry only rejected authentication, never network failures or arbitrary mutation errors. */
export function createSessionFetch(nativeFetch: typeof fetch, recoverSession: () => Promise<boolean>, origin: string): typeof fetch {
  let recovery: Promise<boolean> | null = null;
  let generation = 0;
  const recover = () => {
    if (!recovery) recovery = recoverSession().then((ok) => { if (ok) generation++; return ok; }).catch(() => false).finally(() => { recovery = null; });
    return recovery;
  };
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input), origin);
    if (url.origin !== origin || !url.pathname.startsWith("/api/") || url.pathname.startsWith("/api/auth/")) return nativeFetch(input, init);
    const prepared = new Request(input instanceof Request ? input : url, init);
    // Blob/FormData/string bodies are reusable. Avoid teeing large uploads into a second buffer.
    // Request inputs may contain a consumed stream, so keep one clone only for those callers.
    const retry = input instanceof Request ? prepared.clone() : null;
    const retryInit = { ...init, headers: new Headers(prepared.headers) };
    const startedAt = generation;
    const response = await nativeFetch(prepared);
    let expired = response.status === 401;
    if (url.pathname === "/api/profile/status" && response.ok) expired = Boolean((await response.clone().json().catch(() => ({}))).authRequired);
    if (!expired || prepared.signal.aborted) return response;
    if (startedAt !== generation || await recover()) {
      if (prepared.signal.aborted) return response;
      return nativeFetch(retry || new Request(url, retryInit));
    }
    return response;
  };
}
