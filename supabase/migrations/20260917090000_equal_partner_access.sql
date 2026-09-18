insert into public.allowed_emails (workspace_id, email, role, active)
values
  ('00000000-0000-4000-8000-000000000001', 'nelsonafonsoprofissional@gmail.com', 'admin', true),
  ('00000000-0000-4000-8000-000000000001', 'eduardo04ssousa@gmail.com', 'admin', true),
  ('00000000-0000-4000-8000-000000000001', 'joaotpsilva.pro@gmail.com', 'admin', true)
on conflict (workspace_id, email)
do update set role = 'admin', active = true;

update public.workspace_members as member
set role = 'admin', status = 'active', updated_at = now()
from public.profiles as profile
where profile.user_id = member.user_id
  and profile.workspace_id = member.workspace_id
  and profile.email in (
    'nelsonafonsoprofissional@gmail.com',
    'eduardo04ssousa@gmail.com',
    'joaotpsilva.pro@gmail.com'
  );
