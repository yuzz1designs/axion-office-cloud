alter table public.clients
  add column profile_data jsonb not null default '{}'::jsonb,
  add column logo_path text;

create policy "members delete clients"
on public.clients for delete to authenticated
using (public.is_workspace_member(workspace_id));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-logos', 'client-logos', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
