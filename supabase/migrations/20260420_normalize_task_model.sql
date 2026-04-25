create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.try_parse_legacy_payload(todo_text text)
returns jsonb
language plpgsql
immutable
as $$
declare
  payload text;
begin
  if todo_text is null or left(todo_text, length('[[AI_BREAKDOWN]]')) <> '[[AI_BREAKDOWN]]' then
    return null;
  end if;

  payload := substring(todo_text from length('[[AI_BREAKDOWN]]') + 1);

  begin
    return payload::jsonb;
  exception
    when others then
      return null;
  end;
end;
$$;

create or replace function public.try_parse_timestamptz(value text)
returns timestamptz
language plpgsql
immutable
as $$
begin
  if value is null or btrim(value) = '' then
    return null;
  end if;

  begin
    return value::timestamptz;
  exception
    when others then
      return null;
  end;
end;
$$;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  color text not null default 'gray',
  sort_order bigint not null default 0,
  is_archived boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists projects_user_name_unique on public.projects (user_id, lower(name));

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  sort_order bigint not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists sections_project_name_unique on public.sections (project_id, lower(name));

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  project_id uuid references public.projects(id) on delete set null,
  section_id uuid references public.sections(id) on delete set null,
  parent_id uuid references public.tasks(id) on delete set null,
  title text not null,
  notes text not null default '',
  is_completed boolean not null default false,
  priority smallint not null default 1 check (priority between 1 and 4),
  due_at timestamptz,
  completed_at timestamptz,
  sort_order bigint not null default 0,
  source text not null default 'manual',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists tasks_user_sort_idx on public.tasks (user_id, sort_order desc, created_at desc);

create index if not exists tasks_user_due_idx on public.tasks (user_id, due_at) where due_at is not null;

create index if not exists tasks_user_completed_idx on public.tasks (user_id, is_completed, completed_at desc, created_at desc);

create index if not exists tasks_user_parent_idx on public.tasks (user_id, parent_id);

create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  name text not null,
  color text not null default 'gray',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists labels_user_name_unique on public.labels (user_id, lower(name));

create table if not exists public.task_labels (
  task_id uuid not null references public.tasks(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  user_id text not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (task_id, label_id)
);

create index if not exists task_labels_user_idx on public.task_labels (user_id);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id text not null,
  remind_at timestamptz not null,
  channel text not null default 'in_app',
  is_sent boolean not null default false,
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint reminders_channel_check check (channel in ('in_app', 'email', 'push'))
);

create index if not exists reminders_user_due_idx on public.reminders (user_id, remind_at);

create table if not exists public.recurrences (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null unique references public.tasks(id) on delete cascade,
  user_id text not null,
  rule text not null,
  timezone text not null default 'UTC',
  next_due_at timestamptz,
  preserve_time boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists recurrences_user_next_due_idx on public.recurrences (user_id, next_due_at);

drop trigger if exists set_projects_updated_at on public.projects;
create trigger set_projects_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();

drop trigger if exists set_sections_updated_at on public.sections;
create trigger set_sections_updated_at
before update on public.sections
for each row
execute function public.set_updated_at();

drop trigger if exists set_tasks_updated_at on public.tasks;
create trigger set_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

drop trigger if exists set_labels_updated_at on public.labels;
create trigger set_labels_updated_at
before update on public.labels
for each row
execute function public.set_updated_at();

drop trigger if exists set_reminders_updated_at on public.reminders;
create trigger set_reminders_updated_at
before update on public.reminders
for each row
execute function public.set_updated_at();

drop trigger if exists set_recurrences_updated_at on public.recurrences;
create trigger set_recurrences_updated_at
before update on public.recurrences
for each row
execute function public.set_updated_at();

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'todos'
  ) then
    insert into public.tasks (
      id,
      user_id,
      title,
      notes,
      is_completed,
      priority,
      due_at,
      completed_at,
      sort_order,
      source,
      created_at,
      updated_at
    )
    select
      t.id,
      t.user_id,
      coalesce(
        nullif(btrim(public.try_parse_legacy_payload(t.text) ->> 'title'), ''),
        nullif(btrim(t.text), ''),
        'Untitled task'
      ) as title,
      coalesce(
        nullif(btrim(public.try_parse_legacy_payload(t.text) ->> 'goal'), ''),
        ''
      ) as notes,
      coalesce(t.is_completed, false) as is_completed,
      case t.priority
        when 'urgent' then 4
        else 1
      end as priority,
      public.try_parse_timestamptz(public.try_parse_legacy_payload(t.text) ->> 'due_date') as due_at,
      case
        when coalesce(t.is_completed, false) then timezone('utc', t.created_at)
        else null
      end as completed_at,
      coalesce((extract(epoch from timezone('utc', t.created_at)) * 1000)::bigint, 0) as sort_order,
      case
        when public.try_parse_legacy_payload(t.text) is not null
          and coalesce(nullif(btrim(public.try_parse_legacy_payload(t.text) ->> 'goal'), ''), '') <> ''
          then 'ai_breakdown'
        else 'manual'
      end as source,
      timezone('utc', t.created_at) as created_at,
      timezone('utc', t.created_at) as updated_at
    from public.todos t
    where not exists (select 1 from public.tasks nt where nt.id = t.id);
  end if;
end;
$$;
