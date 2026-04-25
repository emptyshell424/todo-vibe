import { performance } from 'node:perf_hooks';

function isSameLocalDay(left, right) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function isTaskDueToday(task, now) {
  if (!task.due_at) return false;
  const dueAt = new Date(task.due_at);
  return !Number.isNaN(dueAt.getTime()) && isSameLocalDay(dueAt, now);
}

function isTaskOverdue(task, now) {
  if (!task.due_at) return false;
  const dueAt = new Date(task.due_at);
  if (Number.isNaN(dueAt.getTime())) return false;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return dueAt < startOfToday;
}

function isTaskInTodayScope(task, now) {
  return isTaskDueToday(task, now) || isTaskOverdue(task, now);
}

function filterTasksByScope(tasks, { projectId = null, sectionId = null, searchQuery = '' } = {}) {
  const query = searchQuery.trim().toLowerCase();

  return tasks.filter((task) => {
    if (projectId && task.project_id !== projectId) return false;
    if (sectionId && task.section_id !== sectionId) return false;
    if (!query) return true;

    return (
      task.title.toLowerCase().includes(query) ||
      task.notes.toLowerCase().includes(query) ||
      (task.parentTitle?.toLowerCase().includes(query) ?? false)
    );
  });
}

function getDateGroupKey(isoString) {
  const value = new Date(isoString);
  if (Number.isNaN(value.getTime())) return isoString;
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function generateTasks(count) {
  const baseDate = new Date(2026, 3, 22, 9, 0, 0, 0);
  const tasks = [];

  for (let index = 0; index < count; index += 1) {
    const dueDate = new Date(baseDate);
    dueDate.setDate(baseDate.getDate() + ((index % 30) - 10));

    tasks.push({
      id: `task-${index}`,
      user_id: 'scale-user',
      project_id: `project-${index % 12}`,
      section_id: index % 5 === 0 ? null : `section-${index % 24}`,
      parent_id: index % 7 === 0 ? `parent-${Math.floor(index / 7)}` : null,
      parentTitle: index % 7 === 0 ? `Epic ${Math.floor(index / 7)}` : null,
      title: `Task ${index} for scale validation`,
      notes: index % 4 === 0 ? 'Contains follow-up details and checklists.' : '',
      is_completed: index % 6 === 0,
      priority: ((index % 4) + 1),
      due_at: index % 8 === 0 ? null : dueDate.toISOString(),
      completed_at: index % 6 === 0 ? dueDate.toISOString() : null,
      sort_order: count - index,
    });
  }

  return tasks;
}

function measure(label, callback) {
  const startedAt = performance.now();
  const result = callback();
  const durationMs = Number((performance.now() - startedAt).toFixed(2));
  return { label, durationMs, result };
}

function runScenario(count) {
  const now = new Date(2026, 3, 22, 12, 0, 0, 0);
  const tasks = generateTasks(count);

  const todayScope = measure('todayScope', () => tasks.filter((task) => isTaskInTodayScope(task, now)));
  const projectFilter = measure('projectFilter', () =>
    filterTasksByScope(tasks, {
      projectId: 'project-3',
      searchQuery: 'task 9',
    })
  );
  const scheduledGroups = measure('scheduledGroups', () => {
    const groups = new Map();
    for (const task of tasks) {
      if (!task.due_at) continue;
      const key = getDateGroupKey(task.due_at);
      groups.set(key, (groups.get(key) ?? 0) + 1);
    }
    return groups;
  });
  const stats = measure('statsAggregation', () =>
    tasks.reduce(
      (accumulator, task) => {
        accumulator.total += 1;
        accumulator.completed += task.is_completed ? 1 : 0;
        accumulator.active += task.is_completed ? 0 : 1;
        accumulator.p1 += task.priority === 4 ? 1 : 0;
        accumulator.p2 += task.priority === 3 ? 1 : 0;
        accumulator.p3 += task.priority === 2 ? 1 : 0;
        accumulator.p4 += task.priority === 1 ? 1 : 0;
        return accumulator;
      },
      { total: 0, completed: 0, active: 0, p1: 0, p2: 0, p3: 0, p4: 0 }
    )
  );

  if (stats.result.total !== count) {
    throw new Error(`Scale check failed for ${count} tasks: expected total=${count}, received ${stats.result.total}`);
  }

  return [
    { dataset: count, check: todayScope.label, durationMs: todayScope.durationMs, detail: todayScope.result.length },
    { dataset: count, check: projectFilter.label, durationMs: projectFilter.durationMs, detail: projectFilter.result.length },
    { dataset: count, check: scheduledGroups.label, durationMs: scheduledGroups.durationMs, detail: scheduledGroups.result.size },
    { dataset: count, check: stats.label, durationMs: stats.durationMs, detail: `${stats.result.completed}/${stats.result.total}` },
  ];
}

const rows = [...runScenario(1_000), ...runScenario(10_000)];

console.table(rows);
console.log('Task scale smoke checks passed.');
