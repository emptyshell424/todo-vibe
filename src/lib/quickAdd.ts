import type { TaskPriority } from './taskModel';

export type ParsedQuickTask = {
  title: string;
  due_at: string | null;
  priority: TaskPriority;
  recurrenceRule: 'daily' | 'weekly' | 'weekdays' | null;
};

function nextWeekday(targetDay: number, base = new Date()) {
  const next = new Date(base);
  const diff = (targetDay + 7 - next.getDay()) % 7 || 7;
  next.setDate(next.getDate() + diff);
  next.setHours(9, 0, 0, 0);
  return next;
}

function parseDueDate(input: string) {
  const now = new Date();
  const normalized = input.toLowerCase();

  if (/明天|tomorrow/.test(normalized)) {
    const due = new Date(now);
    due.setDate(due.getDate() + 1);
    due.setHours(9, 0, 0, 0);
    return due.toISOString();
  }

  if (/今天|today/.test(normalized)) {
    const due = new Date(now);
    due.setHours(18, 0, 0, 0);
    return due.toISOString();
  }

  if (/下周一|next monday/.test(normalized)) return nextWeekday(1, now).toISOString();
  if (/下周二|next tuesday/.test(normalized)) return nextWeekday(2, now).toISOString();
  if (/下周三|next wednesday/.test(normalized)) return nextWeekday(3, now).toISOString();
  if (/下周四|next thursday/.test(normalized)) return nextWeekday(4, now).toISOString();
  if (/下周五|next friday/.test(normalized)) return nextWeekday(5, now).toISOString();
  if (/下周六|next saturday/.test(normalized)) return nextWeekday(6, now).toISOString();
  if (/下周日|next sunday/.test(normalized)) return nextWeekday(0, now).toISOString();

  const isoDate = normalized.match(/\b(20\d{2}-\d{1,2}-\d{1,2})\b/);
  if (isoDate) {
    const due = new Date(isoDate[1]);
    if (!Number.isNaN(due.getTime())) {
      due.setHours(9, 0, 0, 0);
      return due.toISOString();
    }
  }

  return null;
}

function parsePriority(input: string): TaskPriority {
  const match = input.match(/\b[pP]([1-4])\b/);
  if (!match) {
    return 1;
  }

  const priorityToken = Number(match[1]);
  return (5 - priorityToken) as TaskPriority;
}

function parseRecurrence(input: string): ParsedQuickTask['recurrenceRule'] {
  const normalized = input.toLowerCase();
  if (/every weekday|工作日|每个工作日/.test(normalized)) return 'weekdays';
  if (/every week|weekly|每周/.test(normalized)) return 'weekly';
  if (/every day|daily|每天/.test(normalized)) return 'daily';
  return null;
}

function cleanTitle(input: string) {
  return input
    .replace(/\b[pP][1-4]\b/g, '')
    .replace(/\b20\d{2}-\d{1,2}-\d{1,2}\b/g, '')
    .replace(/明天|今天|下周[一二三四五六日]/g, '')
    .replace(/tomorrow|today|next monday|next tuesday|next wednesday|next thursday|next friday|next saturday|next sunday/gi, '')
    .replace(/every weekday|every week|weekly|every day|daily|每个工作日|工作日|每周|每天/gi, '')
    .trim();
}

export function parseQuickTasks(input: string): ParsedQuickTask[] {
  return input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => ({
      title: cleanTitle(line) || line,
      due_at: parseDueDate(line),
      priority: parsePriority(line),
      recurrenceRule: parseRecurrence(line),
    }));
}
