import type { SupabaseClient } from '@supabase/supabase-js';
import {
  LABEL_SELECT,
  RECURRENCE_SELECT,
  REMINDER_SELECT,
  TASK_LABEL_SELECT,
  coerceLabelRows,
  coerceRecurrenceRows,
  coerceReminderRows,
  coerceTaskLabelRows,
  type Label,
  type RecurrenceRule,
} from './taskModel';

export async function listTaskMetadata(supabase: SupabaseClient, userId: string) {
  const [labels, taskLabels, reminders, recurrences] = await Promise.all([
    supabase.from('labels').select(LABEL_SELECT).eq('user_id', userId),
    supabase.from('task_labels').select(TASK_LABEL_SELECT).eq('user_id', userId),
    supabase.from('reminders').select(REMINDER_SELECT).eq('user_id', userId),
    supabase.from('recurrences').select(RECURRENCE_SELECT).eq('user_id', userId),
  ]);

  return {
    labels: coerceLabelRows(labels.data),
    taskLabels: coerceTaskLabelRows(taskLabels.data),
    reminders: coerceReminderRows(reminders.data),
    recurrences: coerceRecurrenceRows(recurrences.data),
    error: labels.error || taskLabels.error || reminders.error || recurrences.error,
  };
}

export async function createLabel(
  supabase: SupabaseClient,
  label: Pick<Label, 'user_id' | 'name'> & Partial<Pick<Label, 'color'>>
) {
  const { data, error } = await supabase.from('labels').insert(label).select(LABEL_SELECT).single();
  return { data: coerceLabelRows(data ? [data] : [])[0] ?? null, error };
}

export async function deleteLabel(supabase: SupabaseClient, userId: string, labelId: string) {
  return supabase.from('labels').delete().eq('id', labelId).eq('user_id', userId);
}

export async function setTaskLabels(supabase: SupabaseClient, userId: string, taskId: string, labelIds: string[]) {
  const { error: deleteError } = await supabase.from('task_labels').delete().eq('task_id', taskId).eq('user_id', userId);
  if (deleteError) {
    return { error: deleteError };
  }

  if (labelIds.length === 0) {
    return { error: null };
  }

  const rows = labelIds.map((labelId) => ({
    task_id: taskId,
    label_id: labelId,
    user_id: userId,
  }));

  const { error } = await supabase.from('task_labels').insert(rows);
  return { error };
}

export async function upsertReminder(supabase: SupabaseClient, userId: string, taskId: string, remindAt: string | null) {
  if (!remindAt) {
    return supabase.from('reminders').delete().eq('task_id', taskId).eq('user_id', userId);
  }

  const { data: existing } = await supabase.from('reminders').select('id').eq('task_id', taskId).eq('user_id', userId).maybeSingle();
  const payload = {
    task_id: taskId,
    user_id: userId,
    remind_at: remindAt,
    channel: 'in_app',
    is_sent: false,
    sent_at: null,
  };

  if (existing?.id) {
    return supabase.from('reminders').update(payload).eq('id', existing.id).eq('user_id', userId);
  }

  return supabase.from('reminders').insert(payload);
}

export function computeNextDueAt(rule: RecurrenceRule, from = new Date()) {
  const next = new Date(from);

  if (rule === 'weekly') {
    next.setDate(next.getDate() + 7);
    return next.toISOString();
  }

  do {
    next.setDate(next.getDate() + 1);
  } while (rule === 'weekdays' && (next.getDay() === 0 || next.getDay() === 6));

  return next.toISOString();
}

export async function upsertRecurrence(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  rule: RecurrenceRule | null,
  dueAt: string | null
) {
  if (!rule) {
    return supabase.from('recurrences').delete().eq('task_id', taskId).eq('user_id', userId);
  }

  const nextDueAt = computeNextDueAt(rule, dueAt ? new Date(dueAt) : new Date());
  const { data: existing } = await supabase.from('recurrences').select('id').eq('task_id', taskId).eq('user_id', userId).maybeSingle();
  const payload = {
    task_id: taskId,
    user_id: userId,
    rule,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    next_due_at: nextDueAt,
    preserve_time: true,
  };

  if (existing?.id) {
    return supabase.from('recurrences').update(payload).eq('id', existing.id).eq('user_id', userId);
  }

  return supabase.from('recurrences').insert(payload);
}

export async function advanceRecurringTask(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  rule: RecurrenceRule,
  dueAt: string | null
) {
  const nextDueAt = computeNextDueAt(rule, dueAt ? new Date(dueAt) : new Date());
  const [taskResult, recurrenceResult] = await Promise.all([
    supabase
      .from('tasks')
      .update({
        due_at: nextDueAt,
        is_completed: false,
        completed_at: null,
      })
      .eq('id', taskId)
      .eq('user_id', userId),
    supabase
      .from('recurrences')
      .update({ next_due_at: computeNextDueAt(rule, new Date(nextDueAt)) })
      .eq('task_id', taskId)
      .eq('user_id', userId),
  ]);

  return { nextDueAt, error: taskResult.error || recurrenceResult.error };
}
