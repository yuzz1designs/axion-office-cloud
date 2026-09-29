-- Preserve a working session through browser throttling, temporary network loss
-- and short periods of system sleep. Explicit sign-out deletes the row.
create or replace function public.heartbeat_office_presence(p_user_id uuid)
returns timestamptz
language plpgsql
set search_path = public
as $$
declare
  v_workspace_id uuid;
  v_now timestamptz := clock_timestamp();
begin
  select workspace_id into strict v_workspace_id
  from public.workspace_members where user_id = p_user_id and status = 'active';

  insert into public.office_presence(user_id, workspace_id, started_at, last_seen_at)
  values (p_user_id, v_workspace_id, v_now, v_now)
  on conflict (user_id) do update set
    workspace_id = excluded.workspace_id,
    started_at = case
      when office_presence.last_seen_at < excluded.last_seen_at - interval '12 hours'
        or office_presence.workspace_id <> excluded.workspace_id
      then excluded.started_at else office_presence.started_at end,
    last_seen_at = greatest(office_presence.last_seen_at, excluded.last_seen_at);

  return v_now;
end;
$$;

revoke all on function public.heartbeat_office_presence(uuid) from public, anon, authenticated;
grant execute on function public.heartbeat_office_presence(uuid) to service_role;
