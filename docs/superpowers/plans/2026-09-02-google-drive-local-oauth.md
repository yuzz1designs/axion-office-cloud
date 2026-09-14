# Google Drive Local OAuth Uploads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ligar uma conta Google normal ao AXION OFFICE em localhost e carregar ficheiros até 50 MB para a pasta existente `AXION / DOCS` usando a quota dessa conta.

**Architecture:** O backend Express/Vite middleware controla OAuth, tokens e Drive; o browser recebe apenas estado sanitizado. Um store local ignorado pelo Git persiste o refresh token com permissões restritas, enquanto o adapter Drive usa access tokens renovados para uploads e mantém a listagem existente.

**Tech Stack:** TypeScript 5.8, Node.js 22, Express 4, Vite 6, React 19, Google OAuth 2.0 REST, Google Drive API v3, `node:test` via `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-02-google-drive-local-oauth-design.md`

## Global Constraints

- Funciona apenas em `http://localhost:3000` nesta fase.
- OAuth Client do tipo Web application com callback exato `http://localhost:3000/api/google/oauth/callback`.
- Scope temporário: `https://www.googleapis.com/auth/drive` para escrever na pasta My Drive existente.
- Um ficheiro por upload, máximo exato de 50 MB, diretamente na raiz de `DOCS`.
- Client secret, authorization codes, access tokens e refresh tokens nunca chegam ao frontend ou aos logs.
- Grant local em `.axion-local/google-oauth.json`, ignorado pelo Git e com modo `0600`.
- Nenhum endpoint OAuth local deve ser apresentado como pronto para exposição pública.
- Antes de produção: autenticação AXION, tokens encriptados, callbacks HTTPS, auditoria, Google Picker e scopes incrementais.

---

### Task 1: OAuth state e contratos sanitizados

**Files:**
- Create: `src/server/googleOAuthCore.ts`
- Create: `src/server/googleOAuthCore.test.ts`

**Interfaces:**
- Produces: `OAuthGrant`, `PublicOAuthStatus`, `createOAuthState()`, `consumeOAuthState()`, `buildGoogleAuthorizationUrl()`, `toPublicOAuthStatus()`.
- Consumes: variáveis `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_REDIRECT_URI` e constantes de scope.

- [ ] **Step 1: Write failing tests for one-use expiring state**

```ts
test("consome state válido uma única vez", () => {
  const states = new OAuthStateStore(() => 1_000);
  const state = states.create();
  assert.equal(states.consume(state), true);
  assert.equal(states.consume(state), false);
});

test("rejeita state expirado", () => {
  let now = 1_000;
  const states = new OAuthStateStore(() => now, 300_000);
  const state = states.create();
  now += 300_001;
  assert.equal(states.consume(state), false);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --import tsx --test src/server/googleOAuthCore.test.ts`
Expected: FAIL because `googleOAuthCore` does not exist.

- [ ] **Step 3: Implement state, authorization URL and public status**

```ts
export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive";

export interface OAuthGrant {
  refreshToken: string;
  email: string;
  scopes: string[];
  connectedAt: string;
}

export interface PublicOAuthStatus {
  connected: boolean;
  configured: boolean;
  email?: string;
  connectedAt?: string;
  missingScopes: string[];
}

export class OAuthStateStore {
  private readonly states = new Map<string, number>();
  constructor(private now = Date.now, private ttlMs = 300_000) {}
  create() { const state = randomBytes(32).toString("base64url"); this.states.set(state, this.now() + this.ttlMs); return state; }
  consume(state: string) { const expiry = this.states.get(state); this.states.delete(state); return Boolean(expiry && expiry >= this.now()); }
}
```

`buildGoogleAuthorizationUrl()` must set `access_type=offline`, `prompt=consent`, `response_type=code`, the exact redirect URI, scope and one-use state. `toPublicOAuthStatus()` must never include `refreshToken`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --import tsx --test src/server/googleOAuthCore.test.ts`
Expected: all state, URL and sanitization tests PASS.

- [ ] **Step 5: Commit the isolated core**

```bash
git add src/server/googleOAuthCore.ts src/server/googleOAuthCore.test.ts
git commit -m "feat: add local Google OAuth core"
```

### Task 2: Local grant store

**Files:**
- Create: `src/server/googleOAuthStore.ts`
- Create: `src/server/googleOAuthStore.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `OAuthGrant` from Task 1.
- Produces: `GoogleOAuthStore.read(): OAuthGrant | null`, `write(grant): void`, `clear(): void`.

- [ ] **Step 1: Write failing filesystem behavior tests**

Use `mkdtemp()` under the OS temp directory and assert:

```ts
test("persiste e recupera o grant completo", () => {
  const store = new GoogleOAuthStore(testDirectory);
  store.write(grant);
  assert.deepEqual(store.read(), grant);
  assert.equal(statSync(join(testDirectory, "google-oauth.json")).mode & 0o777, 0o600);
});

test("clear remove apenas o grant OAuth", () => {
  const store = new GoogleOAuthStore(testDirectory);
  store.write(grant);
  store.clear();
  assert.equal(store.read(), null);
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `node --import tsx --test src/server/googleOAuthStore.test.ts`
Expected: FAIL because the store is missing.

- [ ] **Step 3: Implement atomic restrictive persistence**

Create the directory with `mode: 0o700`, write JSON to `google-oauth.json.tmp` with `mode: 0o600`, rename atomically to `google-oauth.json`, then enforce `chmodSync(path, 0o600)`. Treat missing files as disconnected; malformed JSON must throw `GOOGLE_OAUTH_STORE_INVALID` rather than silently discarding credentials.

Add exactly:

```gitignore
.axion-local/
```

- [ ] **Step 4: Run store and full tests**

Run: `npm test`
Expected: store tests and existing CRM/Drive tests PASS.

- [ ] **Step 5: Commit the store**

```bash
git add .gitignore src/server/googleOAuthStore.ts src/server/googleOAuthStore.test.ts
git commit -m "feat: persist local Google OAuth grant safely"
```

### Task 3: OAuth client and HTTP endpoints

**Files:**
- Create: `src/server/googleOAuthClient.ts`
- Create: `src/server/googleOAuthClient.test.ts`
- Create: `src/server/googleOAuthApi.ts`
- Modify: `server.ts`
- Modify: `vite.config.ts`
- Modify: `.env.example`

**Interfaces:**
- Consumes: state/store contracts from Tasks 1–2.
- Produces: `exchangeAuthorizationCode()`, `refreshAccessToken()`, `revokeGrant()`, and handlers for `/api/google/oauth/*`.

- [ ] **Step 1: Write failing token response tests with injected fetch**

```ts
test("troca código e exige refresh token", async () => {
  const client = new GoogleOAuthClient(config, fakeFetchReturningTokens);
  const tokens = await client.exchangeAuthorizationCode("code");
  assert.equal(tokens.refreshToken, "refresh-secret");
  assert.equal(tokens.accessToken, "access-secret");
});

test("refresh usa grant_type correto sem expor token", async () => {
  const client = new GoogleOAuthClient(config, recordingFetch);
  await client.refreshAccessToken("refresh-secret");
  assert.match(recordedBody, /grant_type=refresh_token/);
});
```

- [ ] **Step 2: Run focused test and verify RED**

Run: `node --import tsx --test src/server/googleOAuthClient.test.ts`
Expected: FAIL because client methods are missing.

- [ ] **Step 3: Implement Google token and userinfo calls**

POST form data to `https://oauth2.googleapis.com/token`; obtain email from `https://openidconnect.googleapis.com/v1/userinfo`; normalize Google errors to stable internal codes. Accept `fetch` in the constructor for real-behavior tests without network.

- [ ] **Step 4: Implement HTTP routes**

```text
GET  /api/google/oauth/status      -> sanitized JSON only
GET  /api/google/oauth/start       -> 302 to Google or 503 configuration error
GET  /api/google/oauth/callback    -> validate state, exchange, persist, 302 to /?google-drive=connected
POST /api/google/oauth/disconnect  -> revoke best-effort, clear local grant, 200
```

Callback errors redirect to `/?google-drive=error&reason=<stable-code>`; never include Google messages containing codes or tokens. Register the handler before static serving in both Express and Vite middleware.

- [ ] **Step 5: Add environment template**

```env
GOOGLE_OAUTH_CLIENT_ID=000000000000-example.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-example
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/google/oauth/callback
```

- [ ] **Step 6: Run tests, lint and unauthenticated endpoint checks**

Run: `npm test && npm run lint`
Expected: PASS.

Run with OAuth vars absent: `curl -i http://127.0.0.1:3000/api/google/oauth/status`
Expected: `200` with `configured:false`, `connected:false`, no token fields.

- [ ] **Step 7: Commit endpoints**

```bash
git add .env.example server.ts vite.config.ts src/server/googleOAuthApi.ts src/server/googleOAuthClient.ts src/server/googleOAuthClient.test.ts
git commit -m "feat: add localhost Google OAuth endpoints"
```

### Task 4: Drive uploads through user OAuth

**Files:**
- Modify: `src/server/googleDriveApi.ts`
- Modify: `src/server/driveDocument.test.ts`
- Create: `src/server/googleDriveUpload.test.ts`

**Interfaces:**
- Consumes: `GoogleOAuthStore.read()`, `GoogleOAuthClient.refreshAccessToken()`, `GOOGLE_DRIVE_DOCS_FOLDER_ID`.
- Produces: working `POST /api/documents/upload` using user quota; retains `GET /api/documents`.

- [ ] **Step 1: Write failing upload boundary tests**

With injected token provider and fetch, assert that multipart metadata contains the exact parent:

```ts
assert.deepEqual(parsedMetadata.parents, ["1_Xtah1WKj_YoxZoOjNABiM0TjuWBvef8"]);
assert.equal(request.headers.Authorization, "Bearer user-access-token");
```

Also assert disconnected upload returns `409` with code `GOOGLE_DRIVE_OAUTH_REQUIRED`, and refresh rejection clears the unusable local grant.

- [ ] **Step 2: Run upload test and verify RED**

Run: `node --import tsx --test src/server/googleDriveUpload.test.ts`
Expected: FAIL because upload still uses service-account authentication.

- [ ] **Step 3: Replace only the write credential path**

Keep read listing through the current service account. For upload: read OAuth grant, refresh an access token, build the existing validated multipart body, and send it with the user token. Do not fall back to the service account for writes.

Return:

```json
{ "document": { "id": "...", "name": "...", "webViewLink": "..." } }
```

only after Drive returns success and mapped metadata.

- [ ] **Step 4: Run focused and full verification**

Run: `node --import tsx --test src/server/googleDriveUpload.test.ts && npm test && npm run lint`
Expected: all PASS.

- [ ] **Step 5: Commit OAuth-backed upload**

```bash
git add src/server/googleDriveApi.ts src/server/driveDocument.test.ts src/server/googleDriveUpload.test.ts
git commit -m "feat: upload Drive documents with user OAuth"
```

### Task 5: Connection-aware upload interface

**Files:**
- Modify: `src/components/documents/DocumentRepositoryScreen.tsx`

**Interfaces:**
- Consumes: public OAuth status and document upload endpoints.
- Produces: connect/disconnect UI and upload gating without token exposure.

- [ ] **Step 1: Add a failing pure-state test before UI logic**

Extract `getDriveUploadAction(status)` to `src/components/documents/driveUploadState.ts` and test:

```ts
assert.equal(getDriveUploadAction({ configured: false, connected: false }), "configure");
assert.equal(getDriveUploadAction({ configured: true, connected: false }), "connect");
assert.equal(getDriveUploadAction({ configured: true, connected: true }), "upload");
```

Run: `node --import tsx --test src/components/documents/driveUploadState.test.ts`
Expected: FAIL before creating the helper.

- [ ] **Step 2: Implement status loading and connect actions**

On mount, request `/api/google/oauth/status`. `Ligar Google Drive` navigates to `/api/google/oauth/start`. Parse `google-drive=connected|error` once, show a status message, then remove those query parameters with `history.replaceState`.

- [ ] **Step 3: Gate and complete the modal behavior**

When disconnected, keep file selection but replace the final upload action with connect. When connected, show the sanitized account email, retain XHR progress, preserve the selected file on failure, and refresh documents on success. Put disconnect behind a confirmation button and call `POST /api/google/oauth/disconnect`.

- [ ] **Step 4: Run UI state tests, lint and build**

Run: `npm test && npm run lint && npm run build`
Expected: tests PASS, TypeScript zero errors, Vite build succeeds with only the pre-existing chunk-size warning.

- [ ] **Step 5: Commit the interface**

```bash
git add src/components/documents/DocumentRepositoryScreen.tsx src/components/documents/driveUploadState.ts src/components/documents/driveUploadState.test.ts
git commit -m "feat: connect Google Drive uploads in document vault"
```

### Task 6: Local acceptance and production handoff note

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-09-02-google-drive-local-oauth-design.md` only if observed Google behavior requires a factual correction.

**Interfaces:**
- Consumes: completed OAuth and upload flow.
- Produces: reproducible local setup and verified end-to-end evidence.

- [ ] **Step 1: Document exact Google Cloud setup**

Add instructions for Drive API enabled, OAuth consent Testing, AXION account as test user, Web application client, origin `http://localhost:3000`, callback URI, `.env` keys and restart command. Include a warning that this local token store is not production architecture.

- [ ] **Step 2: Verify secrets stay excluded**

Run:

```bash
git check-ignore -v .env .env.local .axion-local/google-oauth.json
git diff --cached --name-only
```

Expected: all secret paths ignored and none staged.

- [ ] **Step 3: Perform real OAuth acceptance**

Start `npm run dev`, connect the AXION test account, and verify status returns `connected:true` with email but no token fields.

- [ ] **Step 4: Perform reversible real upload acceptance**

Upload one uniquely named text fixture smaller than 1 KB through `/api/documents/upload`; verify it appears in `GET /api/documents` and the Drive folder. Delete only that exact fixture by its returned Drive ID, then verify the user's PDF remains.

- [ ] **Step 5: Run final verification**

Run: `npm test && npm run lint && npm run build && git diff --check`
Expected: all tests PASS, TypeScript zero errors, build succeeds, no whitespace errors; the existing bundle warning is documented as non-blocking.

- [ ] **Step 6: Commit setup documentation**

```bash
git add README.md docs/superpowers/specs/2026-09-02-google-drive-local-oauth-design.md
git commit -m "docs: add local Google Drive OAuth setup"
```
