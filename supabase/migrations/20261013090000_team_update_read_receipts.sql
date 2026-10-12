create table public.team_update_reads (
  update_id uuid not null references public.team_updates(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (update_id, user_id)
);

create index team_update_reads_workspace_idx
  on public.team_update_reads (workspace_id, update_id);

alter table public.team_update_reads enable row level security;

create policy "members read update receipts"
  on public.team_update_reads for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "members record own update views"
  on public.team_update_reads for insert to authenticated
  with check (user_id = auth.uid() and public.is_workspace_member(workspace_id));

alter publication supabase_realtime add table public.team_update_reads;
