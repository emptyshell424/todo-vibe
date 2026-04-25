# Todo Vibe

Todo Vibe is a task manager built with `Next.js 16 + React 19 + Ant Design + Clerk + Supabase`.

The current product direction is a stable personal planning workspace: fast capture, clear Inbox/Today semantics, project/section organization, labels, reminders, recurring tasks, and AI breakdown.

## Local Development

Install dependencies:

```bash
npm install
```

Create `.env.local`:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Optional. If omitted, users can configure an AI key in Settings.
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
```

Start the dev server:

```bash
npm run dev
```

Use the proxy variant only when the local machine explicitly needs `127.0.0.1:7897`:

```bash
npm run dev:proxy
```

## Database Setup

Run these SQL files in Supabase SQL Editor, in order:

1. [supabase/migrations/20260420_normalize_task_model.sql](/D:/GitHub_repo/00_active/todo-vibe/supabase/migrations/20260420_normalize_task_model.sql)
2. [supabase/migrations/20260421_enable_clerk_rls.sql](/D:/GitHub_repo/00_active/todo-vibe/supabase/migrations/20260421_enable_clerk_rls.sql)

The normalized model creates:

- `projects`
- `sections`
- `tasks`
- `labels`
- `task_labels`
- `reminders`
- `recurrences`

The RLS migration expects Clerk's Supabase JWT template to be configured correctly. Without that, reads/writes will fail once RLS is enabled.

## Demo Data

Optional demo seed:

- [supabase/seed_demo.sql](/D:/GitHub_repo/00_active/todo-vibe/supabase/seed_demo.sql)

Before running it, replace `demo_user_id` with a real Clerk user id. The seed covers Inbox, Project, Section, Label, Reminder, Recurrence, and an AI-generated parent task.

## Main Workflows

- Today shows only tasks due today or overdue.
- Inbox shows unscheduled tasks without a project.
- Scheduled groups tasks by due date.
- Completed keeps completed history.
- Projects have dedicated routes at `/projects/[projectId]`, with `?section=` used only inside the project view.
- Quick add supports multiple lines plus minimal date/recurrence hints such as `tomorrow`, `today`, `next monday`, `明天`, `下周一`, `daily`, `weekly`, and `every weekday`.
- Reminders can be attached to tasks and surfaced through the in-app reminder poller.
- AI breakdown can turn a larger goal into executable subtasks.

## Verification

Run the regular checks:

```bash
npm run test
npm run check:encoding
npm run check:task-logic
npx tsc --noEmit
npm run lint
npm run build
```

Optional deeper checks:

```bash
npm run check:task-scale
npm run check:rls
```

`npm run check:rls` requires `RLS_TOKEN_USER_A` and `RLS_TOKEN_USER_B` plus the existing Supabase URL and anon key environment variables.

## Key Files

- [src/app/page.tsx](/D:/GitHub_repo/00_active/todo-vibe/src/app/page.tsx): Today view and quick add.
- [src/app/inbox/page.tsx](/D:/GitHub_repo/00_active/todo-vibe/src/app/inbox/page.tsx): Inbox view.
- [src/app/scheduled/page.tsx](/D:/GitHub_repo/00_active/todo-vibe/src/app/scheduled/page.tsx): Scheduled view.
- [src/app/completed/page.tsx](/D:/GitHub_repo/00_active/todo-vibe/src/app/completed/page.tsx): Completed view.
- [src/app/projects/[projectId]/page.tsx](/D:/GitHub_repo/00_active/todo-vibe/src/app/projects/[projectId]/page.tsx): Dedicated project view with section-local filtering.
- [src/components/AppLayout.tsx](/D:/GitHub_repo/00_active/todo-vibe/src/components/AppLayout.tsx): Navigation, project/section/label management, settings.
- [src/components/ReminderNotifier.tsx](/D:/GitHub_repo/00_active/todo-vibe/src/components/ReminderNotifier.tsx): Global in-app reminder polling and notification display.
- [src/components/TodoItem.tsx](/D:/GitHub_repo/00_active/todo-vibe/src/components/TodoItem.tsx): Task row editing.
- [src/components/useManagedTaskList.ts](/D:/GitHub_repo/00_active/todo-vibe/src/components/useManagedTaskList.ts): Shared task-page loading and mutation hook used by the project view.
- [src/app/api/reminders/poll/route.ts](/D:/GitHub_repo/00_active/todo-vibe/src/app/api/reminders/poll/route.ts): Authenticated reminder polling endpoint.
- [src/lib/taskModel.ts](/D:/GitHub_repo/00_active/todo-vibe/src/lib/taskModel.ts): Shared task model and normalization.
- [src/lib/taskRepository.ts](/D:/GitHub_repo/00_active/todo-vibe/src/lib/taskRepository.ts): Task query and mutation helpers.
- [src/lib/taskMetadataRepository.ts](/D:/GitHub_repo/00_active/todo-vibe/src/lib/taskMetadataRepository.ts): Label, reminder, recurrence helpers.
- [src/lib/quickAdd.ts](/D:/GitHub_repo/00_active/todo-vibe/src/lib/quickAdd.ts): Quick add parsing.
