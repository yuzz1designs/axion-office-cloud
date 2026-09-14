create table public.projects (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  name text not null,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  responsible_user_id uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id)
);

create table public.payment_schedules (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  provider text not null,
  category text not null check (category in ('IA', 'Hosting & Cloud', 'Software', 'Marketing', 'Domínios', 'Comunicação', 'Design', 'Produtividade', 'Contabilidade', 'Outros')),
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null default 'EUR' check (currency = upper(currency) and length(currency) = 3),
  billing_type text not null check (billing_type in ('monthly_fixed', 'annual', 'monthly_variable', 'one_time')),
  charge_day smallint check (charge_day between 1 and 31),
  charge_date date,
  next_charge_date date not null,
  payment_method text not null default '',
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'cancelled')),
  auto_renew boolean not null default true,
  responsible_user_id uuid references auth.users(id) on delete set null,
  project_id uuid,
  notes text not null default '',
  website_url text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, project_id) references public.projects(workspace_id, id) on delete set null (project_id),
  unique (workspace_id, id)
);

create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  payment_id uuid,
  payment_name text not null,
  actual_amount numeric(12,2) check (actual_amount is null or actual_amount >= 0),
  currency text not null default 'EUR' check (currency = upper(currency) and length(currency) = 3),
  paid_at timestamptz,
  expected_date date not null,
  status text not null default 'planned' check (status in ('planned', 'paid', 'overdue', 'cancelled')),
  notes text not null default '',
  receipt_file_id uuid references public.file_assets(id) on delete set null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (workspace_id, payment_id) references public.payment_schedules(workspace_id, id) on delete set null (payment_id),
  unique (payment_id, expected_date)
);

create index payment_schedules_workspace_next_charge_idx on public.payment_schedules(workspace_id, next_charge_date);
create index payment_schedules_workspace_category_idx on public.payment_schedules(workspace_id, category);
create index payment_transactions_workspace_paid_at_idx on public.payment_transactions(workspace_id, paid_at desc);
create index payment_transactions_payment_idx on public.payment_transactions(payment_id);

alter table public.projects enable row level security;
alter table public.payment_schedules enable row level security;
alter table public.payment_transactions enable row level security;

create policy "members manage projects" on public.projects for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "members manage payment schedules" on public.payment_schedules for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create policy "members manage payment transactions" on public.payment_transactions for all to authenticated
using (public.is_workspace_member(workspace_id))
with check (public.is_workspace_member(workspace_id));

create or replace function public.mark_payment_paid(
  target_payment_id uuid,
  target_expected_date date,
  actor_user_id uuid,
  paid_amount numeric,
  payment_date timestamptz,
  payment_notes text default ''
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  schedule public.payment_schedules%rowtype;
  target_day integer;
  next_month date;
  next_date date;
begin
  if paid_amount < 0 then raise exception 'FINANCE_INVALID_AMOUNT'; end if;

  select * into schedule from public.payment_schedules
  where id = target_payment_id for update;
  if schedule.id is null then raise exception 'FINANCE_PAYMENT_NOT_FOUND'; end if;
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = schedule.workspace_id and user_id = actor_user_id and status = 'active'
  ) then raise exception 'FINANCE_FORBIDDEN'; end if;
  if schedule.next_charge_date <> target_expected_date then raise exception 'FINANCE_PAYMENT_ALREADY_ADVANCED'; end if;

  insert into public.payment_transactions (
    workspace_id, payment_id, payment_name, actual_amount, currency,
    paid_at, expected_date, status, notes, created_by
  ) values (
    schedule.workspace_id, schedule.id, schedule.name, paid_amount, schedule.currency,
    payment_date, target_expected_date, 'paid', coalesce(payment_notes, ''), actor_user_id
  )
  on conflict (payment_id, expected_date) do update set
    actual_amount = excluded.actual_amount,
    paid_at = excluded.paid_at,
    status = 'paid',
    notes = excluded.notes,
    updated_at = now();

  if schedule.billing_type = 'one_time' then
    update public.payment_schedules set status = 'completed', updated_at = now() where id = schedule.id;
    return;
  end if;

  if schedule.billing_type = 'annual' then
    target_day := extract(day from schedule.next_charge_date);
    next_month := make_date(extract(year from schedule.next_charge_date)::integer + 1, extract(month from schedule.next_charge_date)::integer, 1);
  else
    target_day := coalesce(schedule.charge_day, extract(day from schedule.next_charge_date)::integer);
    next_month := (date_trunc('month', schedule.next_charge_date) + interval '1 month')::date;
  end if;
  next_date := next_month + (least(target_day, extract(day from (next_month + interval '1 month - 1 day'))::integer) - 1);

  update public.payment_schedules
  set next_charge_date = next_date, updated_at = now()
  where id = schedule.id;
end;
$$;

revoke all on function public.mark_payment_paid(uuid, date, uuid, numeric, timestamptz, text) from public;
grant execute on function public.mark_payment_paid(uuid, date, uuid, numeric, timestamptz, text) to authenticated, service_role;
