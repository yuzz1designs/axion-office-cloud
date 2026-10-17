create table public.personal_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '' check (char_length(title) <= 160),
  content text not null default '' check (char_length(content) <= 20000),
  category text not null default 'general' check (category in ('general', 'idea', 'suggestion', 'reminder')),
  visibility text not null default 'private' check (visibility in ('private', 'team')),
  color text not null default '#00f0ff' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  checklist jsonb not null default '[]'::jsonb,
  pinned boolean not null default false,
  archived boolean not null default false,
  reminder_at timestamptz,
  reminder_completed_at timestamptz,
  reminder_notified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index personal_notes_owner_updated_idx on public.personal_notes(owner_user_id, archived, pinned desc, updated_at desc);
create index personal_notes_due_reminder_idx on public.personal_notes(reminder_at) where reminder_at is not null and reminder_completed_at is null and archived = false;

alter table public.personal_notes enable row level security;
create policy "owners and team read notes" on public.personal_notes for select to authenticated
  using (owner_user_id = auth.uid() or (visibility = 'team' and public.is_workspace_member(workspace_id)));
create policy "users create own notes" on public.personal_notes for insert to authenticated
  with check (owner_user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy "users update own notes" on public.personal_notes for update to authenticated
  using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid() and public.is_workspace_member(workspace_id));
create policy "users delete own notes" on public.personal_notes for delete to authenticated using (owner_user_id = auth.uid());

alter publication supabase_realtime add table public.personal_notes;
