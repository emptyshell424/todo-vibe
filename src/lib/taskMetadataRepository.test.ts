import { describe, expect, it } from 'vitest';
import { advanceRecurringTask, computeNextDueAt, upsertRecurrence, upsertReminder } from './taskMetadataRepository';

type RecordedOperation = {
  table: string;
  type: 'select' | 'delete' | 'update' | 'insert';
  payload?: unknown;
  columns?: string;
  filters: Array<[string, unknown]>;
};

function createChain(operation: RecordedOperation) {
  return {
    ...operation,
    error: null,
    eq(field: string, value: unknown) {
      operation.filters.push([field, value]);
      return this;
    },
  };
}

function createMockSupabase({
  reminderId = null,
  recurrenceId = null,
}: {
  reminderId?: string | null;
  recurrenceId?: string | null;
} = {}) {
  const operations: RecordedOperation[] = [];

  const supabase = {
    from(table: string) {
      return {
        delete() {
          const operation: RecordedOperation = { table, type: 'delete', filters: [] };
          operations.push(operation);
          return createChain(operation);
        },
        update(payload: unknown) {
          const operation: RecordedOperation = { table, type: 'update', payload, filters: [] };
          operations.push(operation);
          return createChain(operation);
        },
        insert(payload: unknown) {
          const operation: RecordedOperation = { table, type: 'insert', payload, filters: [] };
          operations.push(operation);
          return { ...operation, error: null };
        },
        select(columns: string) {
          const operation: RecordedOperation = { table, type: 'select', columns, filters: [] };
          operations.push(operation);

          return {
            eq(field: string, value: unknown) {
              operation.filters.push([field, value]);
              return this;
            },
            async maybeSingle() {
              if (table === 'reminders') {
                return { data: reminderId ? { id: reminderId } : null, error: null };
              }

              if (table === 'recurrences') {
                return { data: recurrenceId ? { id: recurrenceId } : null, error: null };
              }

              return { data: null, error: null };
            },
          };
        },
      };
    },
  };

  return { operations, supabase };
}

describe('taskMetadataRepository', () => {
  it('computes recurrence dates for daily, weekly, and weekdays', () => {
    expect(new Date(computeNextDueAt('daily', new Date(2026, 3, 21, 9, 0, 0, 0))).getDate()).toBe(22);
    expect(new Date(computeNextDueAt('weekly', new Date(2026, 3, 21, 9, 0, 0, 0))).getDate()).toBe(28);
    expect(new Date(computeNextDueAt('weekdays', new Date(2026, 3, 24, 9, 0, 0, 0))).getDay()).toBe(1);
  });

  it('deletes reminders when reminderAt is cleared', async () => {
    const { operations, supabase } = createMockSupabase();

    await upsertReminder(supabase as never, 'user-1', 'task-1', null);

    expect(operations).toEqual([
      {
        table: 'reminders',
        type: 'delete',
        filters: [
          ['task_id', 'task-1'],
          ['user_id', 'user-1'],
        ],
      },
    ]);
  });

  it('updates an existing reminder and resets sent state', async () => {
    const { operations, supabase } = createMockSupabase({ reminderId: 'reminder-1' });

    await upsertReminder(supabase as never, 'user-1', 'task-1', '2026-04-22T10:00:00.000Z');

    expect(operations[0]).toMatchObject({
      table: 'reminders',
      type: 'select',
      columns: 'id',
      filters: [
        ['task_id', 'task-1'],
        ['user_id', 'user-1'],
      ],
    });

    expect(operations[1]).toMatchObject({
      table: 'reminders',
      type: 'update',
      payload: {
        task_id: 'task-1',
        user_id: 'user-1',
        remind_at: '2026-04-22T10:00:00.000Z',
        channel: 'in_app',
        is_sent: false,
        sent_at: null,
      },
      filters: [
        ['id', 'reminder-1'],
        ['user_id', 'user-1'],
      ],
    });
  });

  it('inserts a new recurrence with the computed next due date', async () => {
    const { operations, supabase } = createMockSupabase();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    await upsertRecurrence(supabase as never, 'user-1', 'task-1', 'weekly', '2026-04-21T09:00:00.000Z');

    expect(operations[0]).toMatchObject({
      table: 'recurrences',
      type: 'select',
      columns: 'id',
      filters: [
        ['task_id', 'task-1'],
        ['user_id', 'user-1'],
      ],
    });

    expect(operations[1]).toMatchObject({
      table: 'recurrences',
      type: 'insert',
      payload: {
        task_id: 'task-1',
        user_id: 'user-1',
        rule: 'weekly',
        timezone,
        next_due_at: computeNextDueAt('weekly', new Date('2026-04-21T09:00:00.000Z')),
        preserve_time: true,
      },
    });
  });

  it('advances recurring tasks and updates both task and recurrence rows', async () => {
    const { operations, supabase } = createMockSupabase();

    const result = await advanceRecurringTask(
      supabase as never,
      'user-1',
      'task-1',
      'daily',
      '2026-04-21T09:00:00.000Z'
    );

    expect(result.error).toBeNull();
    expect(result.nextDueAt).toBe(computeNextDueAt('daily', new Date('2026-04-21T09:00:00.000Z')));
    expect(operations).toHaveLength(2);
    expect(operations[0]).toMatchObject({
      table: 'tasks',
      type: 'update',
      filters: [
        ['id', 'task-1'],
        ['user_id', 'user-1'],
      ],
    });
    expect(operations[1]).toMatchObject({
      table: 'recurrences',
      type: 'update',
      filters: [
        ['task_id', 'task-1'],
        ['user_id', 'user-1'],
      ],
    });
  });
});
