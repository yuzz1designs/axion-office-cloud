alter table public.oauth_pending_states
  drop constraint if exists oauth_pending_states_provider_check;

alter table public.oauth_pending_states
  add constraint oauth_pending_states_provider_check
  check (provider in ('google_drive', 'google_calendar_tasks', 'google_gmail_quotes'));
