function assert(name, condition) {
  if (!condition) {
    throw new Error(`Task logic check failed: ${name}`);
  }
}

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

function isTaskAfterToday(task, now) {
  if (!task.due_at) return false;
  const dueAt = new Date(task.due_at);
  if (Number.isNaN(dueAt.getTime())) return false;
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return dueAt > endOfToday;
}

function normalizeTaskPriority(value) {
  if (typeof value === 'number' && value >= 1 && value <= 4) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (parsed >= 1 && parsed <= 4) return parsed;
  }
  return 1;
}

function computeNextDueAt(rule, from) {
  const next = new Date(from);
  if (rule === 'weekly') {
    next.setDate(next.getDate() + 7);
    return next;
  }

  do {
    next.setDate(next.getDate() + 1);
  } while (rule === 'weekdays' && (next.getDay() === 0 || next.getDay() === 6));

  return next;
}

const now = new Date('2026-04-21T12:00:00');

assert('unscheduled is not today', !isTaskDueToday({ due_at: null }, now));
assert('today detects same local day', isTaskDueToday({ due_at: '2026-04-21T03:00:00' }, now));
assert('overdue excludes unscheduled', !isTaskOverdue({ due_at: null }, now));
assert('overdue detects previous day', isTaskOverdue({ due_at: '2026-04-20T23:00:00' }, now));
assert('future detects tomorrow', isTaskAfterToday({ due_at: '2026-04-22T09:00:00' }, now));
assert('priority string normalizes', normalizeTaskPriority('4') === 4);
assert('invalid priority falls back', normalizeTaskPriority('9') === 1);
assert('daily recurrence advances one day', computeNextDueAt('daily', new Date('2026-04-21T09:00:00')).getDate() === 22);
assert('weekly recurrence advances seven days', computeNextDueAt('weekly', new Date('2026-04-21T09:00:00')).getDate() === 28);
assert('weekday recurrence skips weekend', computeNextDueAt('weekdays', new Date('2026-04-24T09:00:00')).getDay() === 1);

console.log('Task logic checks passed.');
