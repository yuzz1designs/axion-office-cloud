alter table public.tasks
  add column if not exists meeting_id uuid references public.calendar_events(id) on delete cascade;

create unique index if not exists tasks_meeting_assignee_unique
  on public.tasks (meeting_id, assignee_user_id)
  where meeting_id is not null and assignee_user_id is not null;
