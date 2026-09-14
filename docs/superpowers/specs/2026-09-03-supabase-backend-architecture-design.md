# AXION Supabase Backend Architecture

## Objective

Replace localhost-only persistence with a secure shared backend for the AXION team while keeping the existing dashboard and Google integrations operational during migration.

## Decisions

- PostgreSQL on Supabase is the canonical store for AXION business data.
- Supabase Auth authenticates users; Google login requests only identity scopes.
- Access is restricted to an explicit email allowlist. Possessing the dashboard URL is never authorization.
- The existing AXION server remains the business-logic boundary for privileged mutations, Google tokens, synchronization jobs and audit events.
- Supabase Realtime distributes committed PostgreSQL changes to connected dashboards.
- Google Calendar, Google Tasks, Google Drive and Google Sheets are integrations, not canonical databases.
- Supabase Storage holds profile images and application-owned attachments. The shared Drive `DOCS` folder remains canonical for team documents.
- The visible AX KEY is a public profile identifier only. It cannot authorize privileged actions. Any future secret key must be hashed, revocable and hidden after creation.

## Identity and authorization

`auth.users.id` is the durable user identity. `profiles.user_id` has a one-to-one foreign key to it. A `workspace_members` row links each user to the AXION workspace and contains the application role and membership status.

Initial allowed accounts:

- `nelsonafonsoprofissional@gmail.com`
- `eduardo04ssousa@gmail.com`
- João's email remains pending and must be configured before his first login.

An authentication hook or server callback rejects accounts not present in `allowed_emails`. Every exposed table enables RLS. Policies require an authenticated user and an active membership in the row's `workspace_id`. The Supabase service-role key exists only in server environment variables.

Google identity login and Google Workspace authorization remain separate flows. The latter requests Calendar, Tasks or Drive scopes and stores encrypted provider refresh tokens server-side. Supabase Auth sessions do not replace provider-token lifecycle management.

## Core schema

All identifiers are UUIDs and all mutable tables contain `created_at`, `updated_at` and, where useful, `created_by`/`updated_by`.

| Table | Purpose | Important fields |
|---|---|---|
| `workspaces` | AXION tenant | `id`, `name`, `slug` |
| `allowed_emails` | Login allowlist | `workspace_id`, `email`, `role`, `active` |
| `workspace_members` | User membership and role | `workspace_id`, `user_id`, `role`, `status` |
| `profiles` | User-visible profile | `user_id`, `display_name`, `job_title`, `avatar_path`, `ax_key`, `focus_minutes` |
| `user_devices` | Recognized devices | `user_id`, `device_id_hash`, `label`, `browser`, `os`, `first_seen_at`, `last_seen_at`, `revoked_at` |
| `clients` | Client records | existing CRM fields, `workspace_id`, `owner_user_id`, `status` |
| `tasks` | Canonical tasks | `workspace_id`, `assignee_user_id`, title, notes, due date/time, duration, priority, completion state |
| `calendar_events` | Canonical calendar records | dates, times, Discord location, attendees, category and state |
| `work_logs` | Focus/work history | `user_id`, `task_id`, `minutes`, `source`, `occurred_at` |
| `integration_accounts` | Per-user Google connections | `user_id`, `provider`, encrypted refresh token, scopes, status |
| `integration_links` | Local-to-provider IDs | `entity_type`, `entity_id`, `provider`, `external_id`, `external_updated_at` |
| `sync_jobs` | Transactional synchronization queue | entity, operation, payload, attempts, state, next retry and last error |
| `sync_cursors` | Incremental Google cursors | `user_id`, `provider_resource`, cursor and expiry data |
| `audit_logs` | Security/business audit trail | actor, action, entity, metadata and timestamp |

Completed tasks create an idempotent `work_logs` entry using a unique `(task_id, user_id, source)` constraint. Reopening a task reverses the credited minutes without losing the audit history. `profiles.focus_minutes` may be maintained as a transactionally updated cache, while `work_logs` remains the auditable source.

## Write and synchronization flow

Dashboard writes go to the AXION backend. In one database transaction the backend validates membership, writes the canonical entity and inserts a `sync_jobs` outbox record. It returns the canonical database record immediately. A worker sends the change to Google and records the external ID or retryable failure.

This design keeps new tasks visible in every dashboard even when Google is unavailable. Duplicate deliveries are safe because integration links and idempotency keys identify the same external object.

Inbound Google Calendar changes use Google watch notifications plus incremental sync cursors. Watch channels expire and require scheduled renewal; notifications trigger a fetch rather than containing full event data. Google Tasks is synchronized on dashboard activity, explicit sync and scheduled polling. Provider data is normalized into canonical records before publication through Realtime.

## Realtime

Clients subscribe only to workspace-scoped `tasks`, `calendar_events`, `clients`, `profiles` and relevant notification records. RLS determines which change events each authenticated client can receive. Realtime is a UI delivery mechanism; it does not bypass validation or become the durable store.

Presence can later show who is online, but is not required for the initial migration.

## Files

- `avatars` Supabase bucket: private write access per user, authenticated workspace read access.
- `attachments` Supabase bucket: private workspace files tied to database records.
- Google Drive `DOCS`: shared official documents and the existing document-deposit workflow.
- A `file_assets` record stores provider, bucket/folder, object ID, MIME type, size, checksum and owning entity. A file has one canonical provider to avoid divergent copies.

## Device recognition

The browser receives a random, signed device identifier. Only its hash is stored in `user_devices`. Browser and operating-system strings are descriptive metadata, not authentication factors. Supabase sessions authenticate the user; device records allow display, last-seen tracking and revocation.

## Migration strategy

1. Foundation: create Supabase project configuration, migrations, RLS tests and typed clients.
2. Identity: add allowlisted Google login, memberships, profiles and device records; import the current local profile without changing the visual onboarding.
3. Shared business data: move tasks, events, work logs and clients to PostgreSQL behind the existing API contracts.
4. Realtime: subscribe dashboards to canonical table changes.
5. Integrations: migrate encrypted Google grants, add outbox workers, retries, cursors and Calendar webhook renewal.
6. Storage: move avatars/application attachments while retaining Drive `DOCS`.
7. Cutover: verify record counts and behavior, retain a read-only local export, then remove local JSON writes.

Each phase must be deployable and reversible. Until a phase passes its migration checks, the existing local store remains readable and no source data is deleted.

## Security and operational requirements

- RLS and least-privilege grants on every exposed table and Storage bucket.
- Service-role and Google provider tokens only on the backend.
- Provider refresh tokens encrypted at rest with a server-managed encryption key distinct from database credentials.
- Input validation and membership authorization on every AXION backend mutation.
- Append-only audit logs for login, device revocation, role changes, integration changes and destructive operations.
- Database migrations and policy tests are version-controlled.
- Development, staging and production use separate Supabase projects and OAuth redirect URIs.
- Automated backups cover PostgreSQL; object-storage recovery is planned separately because database backups do not contain stored objects.

## Acceptance criteria

- The three allowlisted users can authenticate and non-allowlisted users are rejected.
- Profiles and recognized devices persist across browsers and server restarts.
- A task or event created by one user appears in the other authorized dashboards without refresh.
- Canonical writes remain visible if Google synchronization fails, with retry status shown.
- Tasks synchronize to the user's `AXION OFFICE` Google Tasks list and dated tasks can appear in Google Calendar.
- Calendar records synchronize bidirectionally without generating Google Meet links.
- Completed-task focus credit is idempotent and auditable.
- Drive `DOCS` remains operational.
- No client bundle or browser storage contains service-role keys or Google refresh tokens.
