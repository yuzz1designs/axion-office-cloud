# AXION OFFICE web on Cloudflare

The `axion-office-cloud` Worker serves `dist` and routes `/api/*` to the existing API handlers through Cloudflare's Node HTTP adapter. AIVA and desktop handoffs are disabled in this web entrypoint. No local filesystem is used for Google grants in the Worker.

## Build and deploy

Cloudflare Builds: repository `yuzz1designs/axion-office-cloud`, branch `main`, root `/`, build `npm run build`, deploy `npx wrangler deploy`. Wrangler configuration is committed. `npm ci --include=dev` installs the build toolchain when building outside Cloudflare Builds.

Required runtime secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`. Optional Google integration secrets: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `AXION_INTEGRATION_KEY` (32 random bytes encoded as base64). Keep the encryption key stable across deployments; changing it prevents reading existing grants. Local `.dev.vars` is ignored by git and must never be included in static assets.

Google Sheets / shared DOCS read access: configure `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_PRIVATE_KEY`; use `GOOGLE_SHEETS_ID` and `GOOGLE_DRIVE_DOCS_FOLDER_ID` for the shared resources. Workers cannot read a `GOOGLE_SERVICE_ACCOUNT_FILE` from a Mac.

Apply the Supabase migrations before publishing. `integration_accounts` stores each user's encrypted Google state. OAuth pending states are hashed, expire after five minutes, and are consumed atomically. Existing local Google sessions are not migrated or shared: each user links their own account again in the web interface.

## External settings

Supabase Authentication → URL Configuration: allow `https://axion-office-cloud.nelsonafonsoprofissional.workers.dev` and its trailing-slash variant. Set the Site URL to this web origin when it becomes the primary app. Preserve existing redirect entries.

The Google provider used for Supabase login must retain the Supabase callback `https://yhprzvkvarjklpncisls.supabase.co/auth/v1/callback`.

For the separate Calendar/Tasks and Drive integration OAuth client, allow these exact Google Cloud redirect URIs:

- `https://axion-office-cloud.nelsonafonsoprofissional.workers.dev/api/google/oauth/callback`
- `https://axion-office-cloud.nelsonafonsoprofissional.workers.dev/api/google/workspace/oauth/callback`

Enable the relevant Drive, Calendar and Tasks APIs and grant the three users access to the OAuth app if it is in testing mode. Service account access to the shared spreadsheet and DOCS folder is independent of personal OAuth consent.

## Verify

- `/api/auth/config`: JSON with `configured: true`; never the SPA HTML.
- `/api/profile/status` without a cookie: `authRequired: true`.
- Protected finance/meeting/Google APIs without a cookie: HTTP 401.
- `/api/aiva/status`: HTTP 503 with `AIVA_DISABLED`.
- Complete a Google login from the public site and verify it returns to the dashboard. Repeat using each partner's own account.
- Link Google from the authenticated profile; verify status, sync and disconnect. Repeat after deployment to verify persistence. No integration should be reported verified solely because the configuration fields are present.

## Verification on 2026-09-17/18

Published Worker version `e2827a10-d5bb-4c89-bfe1-05cb6c1193b8`; cloud source commit `2c776d0`.

154 automated tests, TypeScript and production build passed. The live API returned JSON, set a Secure/HttpOnly session cookie, and correctly required auth for protected endpoints. A temporary admin-generated test session (no email sent, revoked after the check) successfully read profile, finance, meetings, clients, notifications, activity, CRM and DOCS. This validates the backend session bridge, not interactive Google login.

Remaining external configuration was directly checked:
- A Supabase OAuth cancellation test redirected to `http://localhost:3000`, proving the public origin still needs to be allowed in Supabase Auth URL Configuration.
- Both Google integration authorization URLs returned `redirect_uri_mismatch`; the two web callback URIs above need adding to the integration OAuth client in Google Cloud.
- Google Drive / Workspace status is `configured: true, connected: false`; no personal grant was manufactured or copied into the cloud. Each user must consent after callbacks are fixed.
