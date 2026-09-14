drop index if exists public.tasks_meeting_assignee_unique;

create unique index tasks_meeting_assignee_unique
  on public.tasks (meeting_id, assignee_user_id);
