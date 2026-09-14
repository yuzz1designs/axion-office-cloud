alter table public.payment_transactions
  add column expected_amount numeric(12,2) check (expected_amount >= 0);

update public.payment_transactions
set expected_amount = coalesce(actual_amount, 0)
where expected_amount is null;

create or replace function public.set_payment_transaction_expected_amount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.expected_amount is null and new.payment_id is not null then
    select amount into new.expected_amount
    from public.payment_schedules
    where id = new.payment_id;
  end if;
  if new.expected_amount is null then raise exception 'FINANCE_EXPECTED_AMOUNT_REQUIRED'; end if;
  return new;
end;
$$;

create trigger set_payment_transaction_expected_amount
before insert on public.payment_transactions
for each row execute function public.set_payment_transaction_expected_amount();

alter table public.payment_transactions alter column expected_amount set not null;
