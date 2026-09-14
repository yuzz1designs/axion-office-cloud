insert into public.allowed_emails (workspace_id, email, role, active)
values ('00000000-0000-4000-8000-000000000001', 'joaotpsilva.pro@gmail.com', 'partner', true)
on conflict (workspace_id, email)
do update set role = excluded.role, active = true;
