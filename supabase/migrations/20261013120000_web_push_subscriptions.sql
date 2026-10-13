create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null check (char_length(device_id) between 8 and 160),
  endpoint text not null unique check (char_length(endpoint) between 20 and 4096),
  p256dh text not null check (char_length(p256dh) between 20 and 512),
  auth text not null check (char_length(auth) between 8 and 256),
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id)
);

create index push_subscriptions_recipients_idx
  on public.push_subscriptions (workspace_id, user_id);

create table public.push_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_key text not null check (char_length(event_key) between 8 and 240),
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed', 'expired')),
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (event_key, subscription_id)
);

alter table public.push_subscriptions enable row level security;
alter table public.push_notification_deliveries enable row level security;

create policy "users read own push subscriptions"
  on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());

create policy "users create own push subscriptions"
  on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

create policy "users update own push subscriptions"
  on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

create policy "users delete own push subscriptions"
  on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());

create policy "users read own push deliveries"
  on public.push_notification_deliveries for select to authenticated
  using (user_id = auth.uid());
