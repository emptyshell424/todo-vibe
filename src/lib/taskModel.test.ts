import { describe, expect, it } from 'vitest';
import {
  filterTasksByScope,
  getVisibleTasks,
  hydrateTasks,
  isTaskAfterToday,
  isTaskDueToday,
  isTaskInTodayScope,
  isTaskOverdue,
  type DisplayTask,
} from './taskModel';

function makeTask(overrides: Partial<DisplayTask> = {}): DisplayTask {
  return {
    id: overrides.id ?? 'task-1',
    user_id: overrides.user_id ?? 'user-1',
    project_id: overrides.project_id ?? null,
    section_id: overrides.section_id ?? null,
    parent_id: overrides.parent_id ?? null,
    title: overrides.title ?? 'Write tests',
    notes: overrides.notes ?? '',
    is_completed: overrides.is_completed ?? false,
    priority: overrides.priority ?? 1,
    due_at: overrides.due_at ?? null,
    completed_at: overrides.completed_at ?? null,
    sort_order: overrides.sort_order ?? 1,
    source: overrides.source ?? 'manual',
    created_at: overrides.created_at ?? '2026-04-21T09:00:00.000Z',
    updated_at: overrides.updated_at ?? '2026-04-21T09:00:00.000Z',
    parentTitle: overrides.parentTitle ?? null,
  };
}

describe('taskModel', () => {
  it('hydrates parent titles from related tasks', () => {
    const tasks = hydrateTasks([
      {
        id: 'parent',
        user_id: 'user-1',
        title: 'Parent task',
        notes: '',
        is_completed: false,
        priority: 2,
        sort_order: 2,
        source: 'manual',
        created_at: '2026-04-21T09:00:00.000Z',
        updated_at: '2026-04-21T09:00:00.000Z',
      },
      {
        id: 'child',
        user_id: 'user-1',
        parent_id: 'parent',
        title: 'Child task',
        notes: '',
        is_completed: false,
        priority: 1,
        sort_order: 1,
        source: 'manual',
        created_at: '2026-04-21T10:00:00.000Z',
        updated_at: '2026-04-21T10:00:00.000Z',
      },
    ]);

    expect(tasks[1]?.parentTitle).toBe('Parent task');
    expect(getVisibleTasks(tasks)).toEqual(tasks);
  });

  it('filters by project, section, inbox, and search terms', () => {
    const tasks = [
      makeTask({
        id: 'project-match',
        project_id: 'project-1',
        section_id: 'section-1',
        title: 'Finish launch brief',
      }),
      makeTask({
        id: 'inbox-match',
        project_id: null,
        section_id: null,
        title: 'Email vendor',
        notes: 'Contains contract details',
      }),
      makeTask({
        id: 'search-match',
        project_id: 'project-2',
        section_id: null,
        title: 'Review timeline',
        parentTitle: 'Launch plan',
      }),
    ];

    expect(filterTasksByScope(tasks, { projectId: 'project-1' }).map((task) => task.id)).toEqual(['project-match']);
    expect(filterTasksByScope(tasks, { sectionId: 'section-1' }).map((task) => task.id)).toEqual(['project-match']);
    expect(filterTasksByScope(tasks, { inboxOnly: true }).map((task) => task.id)).toEqual(['inbox-match']);
    expect(filterTasksByScope(tasks, { searchQuery: 'contract' }).map((task) => task.id)).toEqual(['inbox-match']);
    expect(filterTasksByScope(tasks, { searchQuery: 'launch plan' }).map((task) => task.id)).toEqual(['search-match']);
  });

  it('computes today, overdue, future, and today-scope states', () => {
    const now = new Date(2026, 3, 21, 12, 0, 0, 0);

    const today = makeTask({ due_at: new Date(2026, 3, 21, 9, 0, 0, 0).toISOString() });
    const overdue = makeTask({ due_at: new Date(2026, 3, 20, 23, 0, 0, 0).toISOString() });
    const future = makeTask({ due_at: new Date(2026, 3, 22, 9, 0, 0, 0).toISOString() });
    const unscheduled = makeTask({ due_at: null });

    expect(isTaskDueToday(today, now)).toBe(true);
    expect(isTaskOverdue(overdue, now)).toBe(true);
    expect(isTaskAfterToday(future, now)).toBe(true);
    expect(isTaskInTodayScope(today, now)).toBe(true);
    expect(isTaskInTodayScope(overdue, now)).toBe(true);
    expect(isTaskInTodayScope(future, now)).toBe(false);
    expect(isTaskInTodayScope(unscheduled, now)).toBe(false);
  });
});
