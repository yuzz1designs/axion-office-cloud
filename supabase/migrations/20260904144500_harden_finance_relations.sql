alter table public.projects
  add constraint projects_responsible_workspace_fk
  foreign key (workspace_id, responsible_user_id)
  references public.workspace_members(workspace_id, user_id)
  on delete set null (responsible_user_id);

alter table public.payment_schedules
  add constraint payment_schedules_responsible_workspace_fk
  foreign key (workspace_id, responsible_user_id)
  references public.workspace_members(workspace_id, user_id)
  on delete set null (responsible_user_id);

revoke execute on function public.mark_payment_paid(uuid, date, uuid, numeric, timestamptz, text) from authenticated;
