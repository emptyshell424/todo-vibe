import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseQuickTasks } from './quickAdd';

describe('quickAdd', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 3, 21, 8, 30, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('parses multiple lines with priority, due date, and recurrence', () => {
    const tasks = parseQuickTasks(['Plan sprint tomorrow p1 daily', 'Review notes 2026-04-25 p3 weekly'].join('\n'));

    expect(tasks).toHaveLength(2);

    expect(tasks[0]).toMatchObject({
      title: 'Plan sprint',
      priority: 4,
      recurrenceRule: 'daily',
    });
    expect(new Date(tasks[0].due_at ?? '').getDate()).toBe(22);
    expect(new Date(tasks[0].due_at ?? '').getHours()).toBe(9);

    expect(tasks[1]).toMatchObject({
      title: 'Review notes',
      priority: 2,
      recurrenceRule: 'weekly',
    });
    expect(new Date(tasks[1].due_at ?? '').getFullYear()).toBe(2026);
    expect(new Date(tasks[1].due_at ?? '').getMonth()).toBe(3);
    expect(new Date(tasks[1].due_at ?? '').getDate()).toBe(25);
  });

  it('supports Chinese date hints and weekday recurrence', () => {
    const [task] = parseQuickTasks(['准备汇报 明天 p2 每个工作日'].join('\n'));

    expect(task).toMatchObject({
      title: '准备汇报',
      priority: 3,
      recurrenceRule: 'weekdays',
    });
    expect(new Date(task.due_at ?? '').getDate()).toBe(22);
    expect(new Date(task.due_at ?? '').getHours()).toBe(9);
  });

  it('keeps non-date text when no scheduling hints are present', () => {
    const [task] = parseQuickTasks(['Call designer about homepage'].join('\n'));

    expect(task).toMatchObject({
      title: 'Call designer about homepage',
      due_at: null,
      priority: 1,
      recurrenceRule: null,
    });
  });
});
