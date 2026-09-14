create or replace function public.handle_axion_user_created()
returns trigger language plpgsql security definer set search_path = '' as $$
declare invitation public.allowed_emails%rowtype;
begin
  select * into invitation from public.allowed_emails
  where email = lower(new.email) and active = true limit 1;
  if invitation.email is null then
    raise exception 'AXION_EMAIL_NOT_ALLOWED';
  end if;
  insert into public.workspace_members (workspace_id, user_id, role)
  values (invitation.workspace_id, new.id, invitation.role);
  insert into public.profiles (user_id, workspace_id, email, ax_key)
  values (new.id, invitation.workspace_id, lower(new.email), 'AX-' || upper(encode(extensions.gen_random_bytes(8), 'hex')));
  return new;
end;
$$;
