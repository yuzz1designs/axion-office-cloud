-- One-use OAuth state must survive Worker restarts and isolate changes.
create table if not exists public.oauth_pending_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google_drive', 'google_calendar_tasks')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.oauth_pending_states enable row level security;
revoke all on public.oauth_pending_states from anon, authenticated;
grant all on public.oauth_pending_states to service_role;
-- Google tokens are written only by the authenticated server OAuth callbacks.
drop policy if exists "users create own integrations" on public.integration_accounts;
drop policy if exists "users update own integrations" on public.integration_accounts;
drop policy if exists "users delete own integrations" on public.integration_accounts;
