-- Demo data for a single Clerk user.
-- Replace demo_user_id before running this file in Supabase SQL Editor.

with demo_user as (
  select 'demo_user_id'::text as user_id
),
project_insert as (
  insert into public.projects (user_id, name, color, sort_order)
  select user_id, 'Launch Plan', 'blue', 100 from demo_user
  returning id, user_id
),
section_insert as (
  insert into public.sections (user_id, project_id, name, sort_order)
  select user_id, id, 'Execution', 100 from project_insert
  returning id, project_id, user_id
),
task_insert as (
  insert into public.tasks (user_id, project_id, section_id, title, notes, priority, due_at, sort_order, source)
  select user_id, project_id, id, 'Review launch checklist', 'Demo task with project, section, due date, reminder, recurrence, and label.', 4, timezone('utc', now() + interval '1 day'), 100, 'ai_breakdown'
  from section_insert
  returning id, user_id
),
label_insert as (
  insert into public.labels (user_id, name, color)
  select user_id, 'migration', 'gray' from demo_user
  returning id, user_id
)
insert into public.task_labels (task_id, label_id, user_id)
select task_insert.id, label_insert.id, task_insert.user_id
from task_insert, label_insert;

insert into public.reminders (task_id, user_id, remind_at, channel)
select id, user_id, timezone('utc', now() + interval '20 hours'), 'in_app'
from public.tasks
where user_id = 'demo_user_id'
  and title = 'Review launch checklist'
limit 1;

insert into public.recurrences (task_id, user_id, rule, timezone, next_due_at, preserve_time)
select id, user_id, 'weekly', 'UTC', timezone('utc', now() + interval '8 days'), true
from public.tasks
where user_id = 'demo_user_id'
  and title = 'Review launch checklist'
limit 1;

insert into public.tasks (user_id, title, notes, priority, sort_order, source)
select 'demo_user_id', 'Inbox sample without a date', 'This should appear in Inbox, not Today.', 2, 90, 'manual'
where not exists (
  select 1 from public.tasks where user_id = 'demo_user_id' and title = 'Inbox sample without a date'
);
