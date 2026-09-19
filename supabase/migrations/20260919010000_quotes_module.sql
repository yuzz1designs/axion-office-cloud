create table public.quote_requests (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null, source text not null default 'manual',
  status text not null default 'new' check (status in ('new','reviewing','qualified','converted','discarded')),
  company_name text not null default '', contact_name text not null default '', contact_email text not null default '', contact_phone text not null default '',
  subject text not null default '', request_summary text not null default '', service_interests jsonb not null default '[]'::jsonb,
  budget_text text not null default '', deadline_text text not null default '', notes text not null default '',
  owner_user_id uuid references auth.users(id) on delete set null, gmail_message_id text, gmail_thread_id text, gmail_received_at timestamptz,
  classification_confidence numeric(4,3) check (classification_confidence is null or classification_confidence between 0 and 1),
  created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (workspace_id, gmail_message_id)
);

create sequence public.quote_reference_sequence;
create table public.quotes (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  request_id uuid references public.quote_requests(id) on delete set null, client_id uuid references public.clients(id) on delete set null,
  reference text not null, status text not null default 'draft' check (status in ('draft','ready','sent','accepted','rejected','expired','cancelled')),
  company_name text not null, contact_name text not null default '', contact_email text not null default '', title text not null, summary text not null default '',
  currency text not null default 'EUR', valid_until date, commitment_months integer check (commitment_months is null or commitment_months >= 0),
  payment_terms text not null default '', client_notes text not null default '', internal_notes text not null default '',
  owner_user_id uuid references auth.users(id) on delete set null, created_by uuid not null references auth.users(id),
  sent_at timestamptz, accepted_at timestamptz, rejected_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (workspace_id, reference)
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(), quote_id uuid not null references public.quotes(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade, category text not null default '', name text not null, description text not null default '',
  pricing_type text not null check (pricing_type in ('project','recurring','performance')), quantity numeric(12,2) not null default 1 check (quantity > 0),
  unit_amount_cents bigint not null default 0 check (unit_amount_cents >= 0), billing_interval text check (billing_interval is null or billing_interval in ('monthly','quarterly','semiannual','annual')),
  performance_metric text not null default '', performance_rate numeric, performance_basis text not null default '', attribution_method text not null default '', performance_conditions text not null default '',
  estimated_hours numeric(10,2) check (estimated_hours is null or estimated_hours >= 0), internal_cost_cents bigint check (internal_cost_cents is null or internal_cost_cents >= 0),
  external_cost_cents bigint check (external_cost_cents is null or external_cost_cents >= 0), included boolean not null default true, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.quote_adjustments (
  id uuid primary key default gen_random_uuid(), quote_id uuid not null references public.quotes(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade, label text not null,
  type text not null check (type in ('percentage','fixed','first_cycle','waive_item')), target text not null default 'initial' check (target in ('initial','recurring','all')),
  value numeric(14,2) not null default 0 check (value >= 0), metadata jsonb not null default '{}'::jsonb, sort_order integer not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.quote_services (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null, category text not null default '', description text not null default '', pricing_type text not null check (pricing_type in ('project','recurring','performance')),
  default_amount_cents bigint check (default_amount_cents is null or default_amount_cents >= 0), default_billing_interval text check (default_billing_interval is null or default_billing_interval in ('monthly','quarterly','semiannual','annual')),
  estimated_hours numeric(10,2) check (estimated_hours is null or estimated_hours >= 0), internal_cost_cents bigint check (internal_cost_cents is null or internal_cost_cents >= 0),
  active boolean not null default true, sort_order integer not null default 0, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.workspace_integrations (
  id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null, provider_email text not null, encrypted_refresh_token text not null, scopes text[] not null default '{}',
  status text not null default 'connected' check (status in ('connected','error','revoked')), last_sync_at timestamptz,
  sync_cursor text, last_error text, connected_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique (workspace_id, provider)
);

create or replace function public.next_quote_reference(target_workspace_id uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare sequence_number bigint;
begin
  if not public.is_workspace_member(target_workspace_id) and auth.role() <> 'service_role' then raise exception 'QUOTE_FORBIDDEN'; end if;
  sequence_number := nextval('public.quote_reference_sequence');
  return 'AX-' || extract(year from now())::integer || '-' || lpad(sequence_number::text, 4, '0');
end; $$;

create index quote_requests_workspace_status_idx on public.quote_requests(workspace_id,status,created_at desc);
create index quotes_workspace_status_idx on public.quotes(workspace_id,status,created_at desc);
create index quote_items_quote_idx on public.quote_items(quote_id,sort_order);
create index quote_adjustments_quote_idx on public.quote_adjustments(quote_id,sort_order);

alter table public.quote_requests enable row level security; alter table public.quotes enable row level security;
alter table public.quote_items enable row level security; alter table public.quote_adjustments enable row level security;
alter table public.quote_services enable row level security; alter table public.workspace_integrations enable row level security;

create policy "members manage quote requests" on public.quote_requests for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members manage quotes" on public.quotes for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members manage quote items" on public.quote_items for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members manage quote adjustments" on public.quote_adjustments for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members manage quote services" on public.quote_services for all to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "members read workspace integrations" on public.workspace_integrations for select to authenticated using (public.is_workspace_member(workspace_id));

alter publication supabase_realtime add table public.quote_requests;
alter publication supabase_realtime add table public.quotes;
alter publication supabase_realtime add table public.quote_services;
