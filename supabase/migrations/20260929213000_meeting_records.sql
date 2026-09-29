alter table public.calendar_events
  add column if not exists meeting_minutes text not null default '',
  add column if not exists meeting_notes text not null default '';

alter table public.tasks
  add column if not exists meeting_task_kind text not null default 'general'
    check (meeting_task_kind in ('general', 'attendance', 'action'));

update public.tasks
set meeting_task_kind = 'attendance'
where meeting_id is not null and meeting_task_kind = 'general';

drop index if exists public.tasks_meeting_assignee_unique;
create unique index tasks_meeting_attendance_assignee_unique
  on public.tasks (meeting_id, assignee_user_id)
  where meeting_id is not null
    and assignee_user_id is not null
    and meeting_task_kind = 'attendance';

create index if not exists tasks_meeting_action_idx
  on public.tasks (meeting_id, created_at)
  where meeting_id is not null and meeting_task_kind = 'action';

create index if not exists file_assets_meeting_idx
  on public.file_assets (entity_id, created_at)
  where entity_type = 'meeting';
