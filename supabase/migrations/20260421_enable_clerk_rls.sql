create or replace function public.current_clerk_user_id()
returns text
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '');
$$;

create or replace function public.is_current_user(row_user_id text)
returns boolean
language sql
stable
as $$
  select row_user_id = public.current_clerk_user_id();
$$;

create or replace function public.user_owns_project(project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select project_id is null
    or exists (
      select 1
      from public.projects p
      where p.id = project_id
        and p.user_id = public.current_clerk_user_id()
    );
$$;

create or replace function public.user_owns_section(section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select section_id is null
    or exists (
      select 1
      from public.sections s
      where s.id = section_id
        and s.user_id = public.current_clerk_user_id()
    );
$$;

create or replace function public.user_owns_task(task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select task_id is null
    or exists (
      select 1
      from public.tasks t
      where t.id = task_id
        and t.user_id = public.current_clerk_user_id()
    );
$$;

create or replace function public.user_owns_label(label_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select label_id is null
    or exists (
      select 1
      from public.labels l
      where l.id = label_id
        and l.user_id = public.current_clerk_user_id()
    );
$$;

alter table public.projects enable row level security;
alter table public.sections enable row level security;
alter table public.tasks enable row level security;
alter table public.labels enable row level security;
alter table public.task_labels enable row level security;
alter table public.reminders enable row level security;
alter table public.recurrences enable row level security;

drop policy if exists "projects_select_own" on public.projects;
drop policy if exists "projects_insert_own" on public.projects;
drop policy if exists "projects_update_own" on public.projects;
drop policy if exists "projects_delete_own" on public.projects;

create policy "projects_select_own"
on public.projects
for select
to authenticated
using (public.is_current_user(user_id));

create policy "projects_insert_own"
on public.projects
for insert
to authenticated
with check (public.is_current_user(user_id));

create policy "projects_update_own"
on public.projects
for update
to authenticated
using (public.is_current_user(user_id))
with check (public.is_current_user(user_id));

create policy "projects_delete_own"
on public.projects
for delete
to authenticated
using (public.is_current_user(user_id));

drop policy if exists "sections_select_own" on public.sections;
drop policy if exists "sections_insert_own" on public.sections;
drop policy if exists "sections_update_own" on public.sections;
drop policy if exists "sections_delete_own" on public.sections;

create policy "sections_select_own"
on public.sections
for select
to authenticated
using (public.is_current_user(user_id));

create policy "sections_insert_own"
on public.sections
for insert
to authenticated
with check (
  public.is_current_user(user_id)
  and public.user_owns_project(project_id)
);

create policy "sections_update_own"
on public.sections
for update
to authenticated
using (public.is_current_user(user_id))
with check (
  public.is_current_user(user_id)
  and public.user_owns_project(project_id)
);

create policy "sections_delete_own"
on public.sections
for delete
to authenticated
using (public.is_current_user(user_id));

drop policy if exists "tasks_select_own" on public.tasks;
drop policy if exists "tasks_insert_own" on public.tasks;
drop policy if exists "tasks_update_own" on public.tasks;
drop policy if exists "tasks_delete_own" on public.tasks;

create policy "tasks_select_own"
on public.tasks
for select
to authenticated
using (public.is_current_user(user_id));

create policy "tasks_insert_own"
on public.tasks
for insert
to authenticated
with check (
  public.is_current_user(user_id)
  and public.user_owns_project(project_id)
  and public.user_owns_section(section_id)
  and public.user_owns_task(parent_id)
);

create policy "tasks_update_own"
on public.tasks
for update
to authenticated
using (public.is_current_user(user_id))
with check (
  public.is_current_user(user_id)
  and public.user_owns_project(project_id)
  and public.user_owns_section(section_id)
  and public.user_owns_task(parent_id)
);

create policy "tasks_delete_own"
on public.tasks
for delete
to authenticated
using (public.is_current_user(user_id));

drop policy if exists "labels_select_own" on public.labels;
drop policy if exists "labels_insert_own" on public.labels;
drop policy if exists "labels_update_own" on public.labels;
drop policy if exists "labels_delete_own" on public.labels;

create policy "labels_select_own"
on public.labels
for select
to authenticated
using (public.is_current_user(user_id));

create policy "labels_insert_own"
on public.labels
for insert
to authenticated
with check (public.is_current_user(user_id));

create policy "labels_update_own"
on public.labels
for update
to authenticated
using (public.is_current_user(user_id))
with check (public.is_current_user(user_id));

create policy "labels_delete_own"
on public.labels
for delete
to authenticated
using (public.is_current_user(user_id));

drop policy if exists "task_labels_select_own" on public.task_labels;
drop policy if exists "task_labels_insert_own" on public.task_labels;
drop policy if exists "task_labels_delete_own" on public.task_labels;

create policy "task_labels_select_own"
on public.task_labels
for select
to authenticated
using (public.is_current_user(user_id));

create policy "task_labels_insert_own"
on public.task_labels
for insert
to authenticated
with check (
  public.is_current_user(user_id)
  and public.user_owns_task(task_id)
  and public.user_owns_label(label_id)
);

create policy "task_labels_delete_own"
on public.task_labels
for delete
to authenticated
using (public.is_current_user(user_id));

drop policy if exists "reminders_select_own" on public.reminders;
drop policy if exists "reminders_insert_own" on public.reminders;
drop policy if exists "reminders_update_own" on public.reminders;
drop policy if exists "reminders_delete_own" on public.reminders;

create policy "reminders_select_own"
on public.reminders
for select
to authenticated
using (public.is_current_user(user_id));

create policy "reminders_insert_own"
on public.reminders
for insert
to authenticated
with check (
  public.is_current_user(user_id)
  and public.user_owns_task(task_id)
);

create policy "reminders_update_own"
on public.reminders
for update
to authenticated
using (public.is_current_user(user_id))
with check (
  public.is_current_user(user_id)
  and public.user_owns_task(task_id)
);

create policy "reminders_delete_own"
on public.reminders
for delete
to authenticated
using (public.is_current_user(user_id));

drop policy if exists "recurrences_select_own" on public.recurrences;
drop policy if exists "recurrences_insert_own" on public.recurrences;
drop policy if exists "recurrences_update_own" on public.recurrences;
drop policy if exists "recurrences_delete_own" on public.recurrences;

create policy "recurrences_select_own"
on public.recurrences
for select
to authenticated
using (public.is_current_user(user_id));

create policy "recurrences_insert_own"
on public.recurrences
for insert
to authenticated
with check (
  public.is_current_user(user_id)
  and public.user_owns_task(task_id)
);

create policy "recurrences_update_own"
on public.recurrences
for update
to authenticated
using (public.is_current_user(user_id))
with check (
  public.is_current_user(user_id)
  and public.user_owns_task(task_id)
);

create policy "recurrences_delete_own"
on public.recurrences
for delete
to authenticated
using (public.is_current_user(user_id));
