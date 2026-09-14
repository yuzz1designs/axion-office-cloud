alter table public.clients
  add constraint clients_workspace_id_id_key unique (workspace_id, id);

alter table public.revenue_entries
  drop constraint revenue_entries_client_id_fkey,
  add constraint revenue_entries_workspace_client_fk
    foreign key (workspace_id, client_id)
    references public.clients(workspace_id, id)
    on delete set null (client_id);
