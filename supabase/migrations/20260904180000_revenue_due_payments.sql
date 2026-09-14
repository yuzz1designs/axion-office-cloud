alter table public.revenue_entries
  add column payer_name text not null default '',
  add column due_date date,
  add column received_amount numeric(12,2) check (received_amount is null or received_amount >= 0);

update public.revenue_entries set due_date = received_date where due_date is null;

alter table public.revenue_entries
  alter column due_date set not null,
  alter column received_date drop not null;

create index revenue_entries_workspace_due_idx
on public.revenue_entries(workspace_id, due_date, status);
