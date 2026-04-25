import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { type ReminderPollResponse, type ReminderNotificationPayload } from '@/lib/api';
import { coerceReminderRows } from '@/lib/taskModel';
import { createServerClerkSupabaseClient } from '@/lib/supabaseServer';

type ReminderRow = Record<string, unknown> & {
  task?: Record<string, unknown> | Record<string, unknown>[] | null;
};

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ code, message }, { status });
}

function coerceReminderResultRows(value: unknown): ReminderRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is ReminderRow => !!item && typeof item === 'object');
}

function getEmbeddedTask(value: ReminderRow['task']) {
  if (Array.isArray(value)) {
    return value.find((item): item is Record<string, unknown> => !!item && typeof item === 'object') ?? null;
  }

  return value && typeof value === 'object' ? value : null;
}

export async function POST() {
  try {
    const { userId, getToken } = await auth();
    if (!userId) {
      return jsonError(401, 'unauthorized', '请先登录后再同步提醒。');
    }

    const token = await getToken({ template: 'supabase' });
    if (!token) {
      return jsonError(401, 'supabase_token_missing', '当前会话缺少数据库访问令牌，请检查登录配置。');
    }

    const supabase = createServerClerkSupabaseClient(async () => token);
    const polledAt = new Date().toISOString();

    const { data, error } = await supabase
      .from('reminders')
      .update({
        is_sent: true,
        sent_at: polledAt,
      })
      .eq('user_id', userId)
      .eq('channel', 'in_app')
      .eq('is_sent', false)
      .lte('remind_at', polledAt)
      .select('id,task_id,user_id,remind_at,channel,is_sent,sent_at,created_at,updated_at,task:tasks(id,title,due_at,project_id,section_id)');

    if (error) {
      console.error('[Reminder Poll] Failed to sync reminders:', error);
      return jsonError(500, 'reminder_poll_failed', '提醒同步失败，请稍后重试。');
    }

    const rows = coerceReminderResultRows(data);
    const taskByReminderId = new Map(
      rows.map((row) => [String(row.id), getEmbeddedTask(row.task)])
    );

    const reminders: ReminderNotificationPayload[] = coerceReminderRows(rows).map((reminder) => {
      const task = taskByReminderId.get(reminder.id);

      return {
        id: reminder.id,
        taskId: reminder.task_id,
        taskTitle: typeof task?.title === 'string' ? task.title : '',
        remindAt: reminder.remind_at,
        sentAt: reminder.sent_at,
        dueAt: typeof task?.due_at === 'string' ? task.due_at : null,
        projectId: task?.project_id ? String(task.project_id) : null,
        sectionId: task?.section_id ? String(task.section_id) : null,
      };
    });

    const response: ReminderPollResponse = {
      reminders,
      polledAt,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Reminder Poll] Route failed:', error);
    return jsonError(500, 'reminder_poll_failed', '提醒同步失败，请稍后重试。');
  }
}
