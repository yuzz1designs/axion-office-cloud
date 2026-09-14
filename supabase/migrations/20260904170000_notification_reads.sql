create table public.notification_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_key text not null,
  read_at timestamptz not null default now(),
  primary key (user_id, notification_key),
  constraint notification_key_not_empty check (length(trim(notification_key)) > 0)
);

alter table public.notification_reads enable row level security;

create policy "users manage their notification reads"
on public.notification_reads
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notification_reads'
  ) then
    alter publication supabase_realtime add table public.notification_reads;
  end if;
end $$;
