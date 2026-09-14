create extension if not exists pgcrypto;

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.allowed_emails (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'partner', 'member')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (workspace_id, email),
  check (email = lower(trim(email)))
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'partner', 'member')),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null unique,
  display_name text not null default '',
  preferred_name text not null default '',
  job_title text not null default '',
  department text not null default '',
  phone text not null default '',
  desk_location text not null default '',
  timezone text not null default 'Europe/Lisbon',
  bio text not null default '',
  avatar_path text not null default '',
  initials text not null default '',
  accent_color text not null default '#FFFFFF',
  ax_key text not null unique,
  focus_minutes integer not null default 0 check (focus_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  device_id_hash text not null,
  label text not null,
  browser text not null default '',
  operating_system text not null default '',
  ip_address inet,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (user_id, device_id_hash)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  external_ref text not null,
  company text not null,
  website text not null default '',
  sector text not null default '',
  country text not null default '',
  city text not null default '',
  source text not null default '',
  ideal_fit text not null default '',
  priority text not null default '',
  owner_user_id uuid references auth.users(id) on delete set null,
  owner_label text not null default '',
  lead_status text not null default '',
  source_created_at text not null default '',
  last_contact text not null default '',
  next_action text not null default '',
  service_interest text not null default '',
  estimated_monthly_value text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, external_ref)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  assignee_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  notes text not null default '',
  due_date date,
  due_time time,
  estimated_minutes integer not null default 30 check (estimated_minutes > 0),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  completed boolean not null default false,
  completed_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  description text not null default '',
  event_date date not null,
  start_time time not null,
  end_time time not null,
  location_type text not null default 'discord_stage' check (location_type = 'discord_stage'),
  location_url text not null default '',
  status text not null default 'scheduled' check (status in ('scheduled', 'in_progress', 'completed', 'cancelled')),
  category text not null default 'internal',
  attendees jsonb not null default '[]'::jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.work_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  minutes integer not null check (minutes <> 0),
  source text not null default 'task_completion',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, task_id, source)
);

create table public.integration_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('google_calendar_tasks', 'google_drive', 'google_sheets')),
  provider_email text not null,
  encrypted_refresh_token text not null,
  scopes text[] not null default '{}',
  status text not null default 'connected' check (status in ('connected', 'error', 'revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table public.integration_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_type text not null check (entity_type in ('task', 'calendar_event', 'client', 'file')),
  entity_id uuid not null,
  provider text not null,
  external_id text not null,
  external_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, entity_type, external_id),
  unique (provider, entity_type, entity_id)
);

create table public.sync_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  provider text not null,
  operation text not null check (operation in ('create', 'update', 'delete', 'pull')),
  payload jsonb not null default '{}'::jsonb,
  state text not null default 'pending' check (state in ('pending', 'processing', 'completed', 'failed')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  workspace_id uuid references public.workspaces(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.file_assets (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  provider text not null check (provider in ('supabase', 'google_drive')),
  container text not null,
  object_id text not null,
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  checksum text,
  entity_type text,
  entity_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, container, object_id)
);

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id and user_id = auth.uid() and status = 'active'
  );
$$;

create or replace function public.handle_axion_user_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare invitation public.allowed_emails%rowtype;
begin
  select * into invitation from public.allowed_emails
  where email = lower(new.email) and active = true limit 1;
  if invitation.email is null then
    raise exception 'AXION_EMAIL_NOT_ALLOWED';
  end if;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (invitation.workspace_id, new.id, invitation.role);
  insert into public.profiles (user_id, workspace_id, email, ax_key)
  values (new.id, invitation.workspace_id, lower(new.email), 'AX-' || upper(encode(extensions.gen_random_bytes(8), 'hex')));
  return new;
end;
$$;

create trigger on_axion_user_created after insert on auth.users
for each row execute function public.handle_axion_user_created();

alter table public.workspaces enable row level security;
alter table public.allowed_emails enable row level security;
alter table public.workspace_members enable row level security;
alter table public.profiles enable row level security;
alter table public.user_devices enable row level security;
alter table public.clients enable row level security;
alter table public.tasks enable row level security;
alter table public.calendar_events enable row level security;
alter table public.work_logs enable row level security;
alter table public.integration_accounts enable row level security;
alter table public.integration_links enable row level security;
alter table public.sync_jobs enable row level security;
alter table public.audit_logs enable row level security;
alter table public.file_assets enable row level security;

create policy "members read workspace" on public.workspaces for select to authenticated using (public.is_workspace_member(id));
create policy "members read memberships" on public.workspace_members for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members read profiles" on public.profiles for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "users update own profile" on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy "users read own devices" on public.user_devices for select to authenticated using (user_id = auth.uid());
create policy "users manage own devices" on public.user_devices for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "members read clients" on public.clients for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members create clients" on public.clients for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "members update clients" on public.clients for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members read tasks" on public.tasks for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members create tasks" on public.tasks for insert to authenticated with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy "members update tasks" on public.tasks for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members read events" on public.calendar_events for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members create events" on public.calendar_events for insert to authenticated with check (public.is_workspace_member(workspace_id) and created_by = auth.uid());
create policy "members update events" on public.calendar_events for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members read work logs" on public.work_logs for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "users create own work logs" on public.work_logs for insert to authenticated with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy "members read file metadata" on public.file_assets for select to authenticated using (public.is_workspace_member(workspace_id));

insert into public.workspaces (id, name, slug)
values ('00000000-0000-4000-8000-000000000001', 'AXION', 'axion')
on conflict (id) do nothing;

insert into public.allowed_emails (workspace_id, email, role) values
  ('00000000-0000-4000-8000-000000000001', 'nelsonafonsoprofissional@gmail.com', 'admin'),
  ('00000000-0000-4000-8000-000000000001', 'eduardo04ssousa@gmail.com', 'partner')
on conflict (workspace_id, email) do update set role = excluded.role, active = true;

insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', false),
  ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "authenticated users read avatars" on storage.objects for select to authenticated using (bucket_id = 'avatars');
create policy "users upload own avatars" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update own avatars" on storage.objects for update to authenticated using (bucket_id = 'avatars' and owner_id = auth.uid()::text) with check (bucket_id = 'avatars' and owner_id = auth.uid()::text);

alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.calendar_events;
alter publication supabase_realtime add table public.work_logs;
alter publication supabase_realtime add table public.clients;
