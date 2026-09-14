create policy "members read audit logs" on public.audit_logs for select to authenticated
using (public.is_workspace_member(workspace_id));

do $$
declare table_name text;
begin
  foreach table_name in array array['audit_logs', 'revenue_entries', 'payment_schedules', 'payment_transactions'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end;
$$;
