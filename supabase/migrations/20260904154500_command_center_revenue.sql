create table public.revenue_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  project_id uuid,
  client_id uuid references public.clients(id) on delete set null,
  source text not null default 'manual',
  description text not null,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'EUR' check (currency = upper(currency) and length(currency) = 3),
  received_date date not null,
  status text not null default 'received' check (status in ('received', 'pending', 'cancelled')),
  notes text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, project_id) references public.projects(workspace_id, id) on delete set null (project_id)
);

create index revenue_entries_workspace_received_idx on public.revenue_entries(workspace_id, received_date desc);

alter table public.revenue_entries enable row level security;
create policy "members manage revenue entries" on public.revenue_entries for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));
