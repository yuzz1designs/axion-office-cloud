create table public.team_updates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  author_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 1 and 2000),
  published_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index team_updates_workspace_created_idx on public.team_updates(workspace_id, created_at desc);
alter table public.team_updates enable row level security;
create policy "members read team updates" on public.team_updates for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "members publish own updates" on public.team_updates for insert to authenticated with check (public.is_workspace_member(workspace_id) and author_user_id = auth.uid());
alter publication supabase_realtime add table public.team_updates;
