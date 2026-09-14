alter table public.integration_accounts
  drop constraint if exists integration_accounts_provider_check;

alter table public.integration_accounts
  add constraint integration_accounts_provider_check
  check (provider in ('google_calendar_tasks', 'google_drive', 'google_sheets', 'discord'));

alter table public.integration_accounts
  add column if not exists external_user_id text,
  add column if not exists external_display_name text not null default '';

create unique index if not exists integration_accounts_provider_external_user_unique
  on public.integration_accounts (provider, external_user_id)
  where external_user_id is not null;

create policy "users read own integrations" on public.integration_accounts
  for select to authenticated using (user_id = auth.uid());

create policy "users create own integrations" on public.integration_accounts
  for insert to authenticated with check (
    user_id = auth.uid() and public.is_workspace_member(workspace_id)
  );

create policy "users update own integrations" on public.integration_accounts
  for update to authenticated using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

create policy "users delete own integrations" on public.integration_accounts
  for delete to authenticated using (user_id = auth.uid());
