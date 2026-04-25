export const TASK_SELECT = [
  'id',
  'user_id',
  'project_id',
  'section_id',
  'parent_id',
  'title',
  'notes',
  'is_completed',
  'priority',
  'due_at',
  'completed_at',
  'sort_order',
  'source',
  'created_at',
  'updated_at',
].join(',');

export const PROJECT_SELECT = [
  'id',
  'user_id',
  'name',
  'color',
  'sort_order',
  'is_archived',
  'created_at',
  'updated_at',
].join(',');

export const SECTION_SELECT = [
  'id',
  'user_id',
  'project_id',
  'name',
  'sort_order',
  'created_at',
  'updated_at',
].join(',');

export const LABEL_SELECT = [
  'id',
  'user_id',
  'name',
  'color',
  'created_at',
  'updated_at',
].join(',');

export const TASK_LABEL_SELECT = [
  'task_id',
  'label_id',
  'user_id',
  'created_at',
].join(',');

export const REMINDER_SELECT = [
  'id',
  'task_id',
  'user_id',
  'remind_at',
  'channel',
  'is_sent',
  'sent_at',
  'created_at',
  'updated_at',
].join(',');

export const RECURRENCE_SELECT = [
  'id',
  'task_id',
  'user_id',
  'rule',
  'timezone',
  'next_due_at',
  'preserve_time',
  'created_at',
  'updated_at',
].join(',');

export type TaskPriority = 1 | 2 | 3 | 4;
export type TaskSource = 'manual' | 'ai_breakdown' | 'ai_plan' | string;
export type Language = 'en' | 'zh';
export type TaskRecord = Record<string, unknown>;

export interface Project {
  id: string;
  user_id: string;
  name: string;
  color: string;
  sort_order: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Section {
  id: string;
  user_id: string;
  project_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Label {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface TaskLabel {
  task_id: string;
  label_id: string;
  user_id: string;
  created_at: string;
}

export interface Reminder {
  id: string;
  task_id: string;
  user_id: string;
  remind_at: string;
  channel: 'in_app' | 'email' | 'push';
  is_sent: boolean;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Recurrence {
  id: string;
  task_id: string;
  user_id: string;
  rule: string;
  timezone: string;
  next_due_at: string | null;
  preserve_time: boolean;
  created_at: string;
  updated_at: string;
}

export type RecurrenceRule = 'daily' | 'weekly' | 'weekdays';

export interface Task {
  id: string;
  user_id: string;
  project_id: string | null;
  section_id: string | null;
  parent_id: string | null;
  title: string;
  notes: string;
  is_completed: boolean;
  priority: TaskPriority;
  due_at: string | null;
  completed_at: string | null;
  sort_order: number;
  source: TaskSource;
  created_at: string;
  updated_at: string;
}

export type DisplayTask = Task & {
  parentTitle: string | null;
};

export type TaskFilterOptions = {
  projectId?: string | null;
  sectionId?: string | null;
  searchQuery?: string;
  inboxOnly?: boolean;
};

export function normalizeTaskPriority(value: unknown): TaskPriority {
  if (typeof value === 'number' && value >= 1 && value <= 4) {
    return value as TaskPriority;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    if (parsed >= 1 && parsed <= 4) {
      return parsed as TaskPriority;
    }
  }

  return 1;
}

export function normalizeTaskRow(row: TaskRecord): Task {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    project_id: row.project_id ? String(row.project_id) : null,
    section_id: row.section_id ? String(row.section_id) : null,
    parent_id: row.parent_id ? String(row.parent_id) : null,
    title: typeof row.title === 'string' ? row.title : '',
    notes: typeof row.notes === 'string' ? row.notes : '',
    is_completed: Boolean(row.is_completed),
    priority: normalizeTaskPriority(row.priority),
    due_at: typeof row.due_at === 'string' ? row.due_at : null,
    completed_at: typeof row.completed_at === 'string' ? row.completed_at : null,
    sort_order: typeof row.sort_order === 'number' ? row.sort_order : Number(row.sort_order ?? 0),
    source: typeof row.source === 'string' ? row.source : 'manual',
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
  };
}

export function coerceTaskRows(value: unknown): TaskRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is TaskRecord => !!item && typeof item === 'object');
}

export function coerceProjectRows(value: unknown): Project[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is TaskRecord => !!item && typeof item === 'object')
    .map((row) => ({
      id: String(row.id),
      user_id: String(row.user_id),
      name: typeof row.name === 'string' ? row.name : '',
      color: typeof row.color === 'string' ? row.color : 'gray',
      sort_order: typeof row.sort_order === 'number' ? row.sort_order : Number(row.sort_order ?? 0),
      is_archived: Boolean(row.is_archived),
      created_at: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
      updated_at: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
    }))
    .sort((left, right) => right.sort_order - left.sort_order || left.name.localeCompare(right.name));
}

export function coerceSectionRows(value: unknown): Section[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is TaskRecord => !!item && typeof item === 'object')
    .map((row) => ({
      id: String(row.id),
      user_id: String(row.user_id),
      project_id: String(row.project_id),
      name: typeof row.name === 'string' ? row.name : '',
      sort_order: typeof row.sort_order === 'number' ? row.sort_order : Number(row.sort_order ?? 0),
      created_at: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
      updated_at: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
    }))
    .sort((left, right) => right.sort_order - left.sort_order || left.name.localeCompare(right.name));
}

export function coerceLabelRows(value: unknown): Label[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is TaskRecord => !!item && typeof item === 'object')
    .map((row) => ({
      id: String(row.id),
      user_id: String(row.user_id),
      name: typeof row.name === 'string' ? row.name : '',
      color: typeof row.color === 'string' ? row.color : 'gray',
      created_at: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
      updated_at: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function coerceTaskLabelRows(value: unknown): TaskLabel[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is TaskRecord => !!item && typeof item === 'object')
    .map((row) => ({
      task_id: String(row.task_id),
      label_id: String(row.label_id),
      user_id: String(row.user_id),
      created_at: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
    }));
}

function normalizeReminderChannel(value: unknown): Reminder['channel'] {
  if (value === 'email' || value === 'push') {
    return value;
  }

  return 'in_app';
}

export function coerceReminderRows(value: unknown): Reminder[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is TaskRecord => !!item && typeof item === 'object')
    .map((row) => ({
      id: String(row.id),
      task_id: String(row.task_id),
      user_id: String(row.user_id),
      remind_at: typeof row.remind_at === 'string' ? row.remind_at : new Date(0).toISOString(),
      channel: normalizeReminderChannel(row.channel),
      is_sent: Boolean(row.is_sent),
      sent_at: typeof row.sent_at === 'string' ? row.sent_at : null,
      created_at: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
      updated_at: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
    }))
    .sort((left, right) => left.remind_at.localeCompare(right.remind_at));
}

export function coerceRecurrenceRows(value: unknown): Recurrence[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is TaskRecord => !!item && typeof item === 'object')
    .map((row) => ({
      id: String(row.id),
      task_id: String(row.task_id),
      user_id: String(row.user_id),
      rule: typeof row.rule === 'string' ? row.rule : 'daily',
      timezone: typeof row.timezone === 'string' ? row.timezone : 'UTC',
      next_due_at: typeof row.next_due_at === 'string' ? row.next_due_at : null,
      preserve_time: Boolean(row.preserve_time),
      created_at: typeof row.created_at === 'string' ? row.created_at : new Date(0).toISOString(),
      updated_at: typeof row.updated_at === 'string' ? row.updated_at : new Date(0).toISOString(),
    }));
}

export function hydrateTasks(rows: TaskRecord[]): DisplayTask[] {
  const tasks = rows.map(normalizeTaskRow);
  const byId = new Map(tasks.map((task) => [task.id, task]));

  return tasks.map((task) => ({
    ...task,
    parentTitle: task.parent_id ? byId.get(task.parent_id)?.title ?? null : null,
  }));
}

export function getVisibleTasks(tasks: DisplayTask[]): DisplayTask[] {
  return tasks;
}

export function matchesTaskSearch(task: Pick<DisplayTask, 'title' | 'notes' | 'parentTitle'>, searchQuery: string) {
  const query = searchQuery.trim().toLowerCase();
  if (!query) {
    return true;
  }

  return (
    task.title.toLowerCase().includes(query) ||
    task.notes.toLowerCase().includes(query) ||
    (task.parentTitle?.toLowerCase().includes(query) ?? false)
  );
}

export function filterTasksByScope(tasks: DisplayTask[], options: TaskFilterOptions = {}) {
  const { projectId = null, sectionId = null, searchQuery = '', inboxOnly = false } = options;

  return tasks.filter((task) => {
    if (inboxOnly && task.project_id) {
      return false;
    }

    if (projectId && task.project_id !== projectId) {
      return false;
    }

    if (sectionId && task.section_id !== sectionId) {
      return false;
    }

    return matchesTaskSearch(task, searchQuery);
  });
}

export function isSameLocalDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function isTaskDueToday(task: Pick<Task, 'due_at'>, now = new Date()) {
  if (!task.due_at) {
    return false;
  }

  const dueAt = new Date(task.due_at);
  if (Number.isNaN(dueAt.getTime())) {
    return false;
  }

  return isSameLocalDay(dueAt, now);
}

export function isTaskOverdue(task: Pick<Task, 'due_at'>, now = new Date()) {
  if (!task.due_at) {
    return false;
  }

  const dueAt = new Date(task.due_at);
  if (Number.isNaN(dueAt.getTime())) {
    return false;
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return dueAt < startOfToday;
}

export function isTaskAfterToday(task: Pick<Task, 'due_at'>, now = new Date()) {
  if (!task.due_at) {
    return false;
  }

  const dueAt = new Date(task.due_at);
  if (Number.isNaN(dueAt.getTime())) {
    return false;
  }

  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  return dueAt > endOfToday;
}

export function isTaskInTodayScope(task: Pick<Task, 'due_at'>, now = new Date()) {
  return isTaskDueToday(task, now) || isTaskOverdue(task, now);
}

export function getDateGroupKey(isoString: string) {
  const value = new Date(isoString);
  if (Number.isNaN(value.getTime())) {
    return isoString;
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateGroupLabel(dateKey: string, language: Language) {
  const [year, month, day] = dateKey.split('-').map((part) => Number.parseInt(part, 10));
  const value = new Date(year, (month || 1) - 1, day || 1);
  if (Number.isNaN(value.getTime())) {
    return dateKey;
  }

  return value.toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  });
}

export function formatTaskTimeLabel(task: Pick<Task, 'due_at' | 'created_at'>, language: Language) {
  const locale = language === 'zh' ? 'zh-CN' : 'en-US';
  const dueAt = task.due_at ? new Date(task.due_at) : null;

  if (dueAt && !Number.isNaN(dueAt.getTime())) {
    return dueAt.toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const createdAt = new Date(task.created_at);
  if (!Number.isNaN(createdAt.getTime())) {
    return createdAt.toLocaleString(locale, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return language === 'zh' ? '未安排' : 'Unscheduled';
}

export function formatPriorityLabel(priority: TaskPriority) {
  switch (priority) {
    case 4:
      return 'P1';
    case 3:
      return 'P2';
    case 2:
      return 'P3';
    default:
      return 'P4';
  }
}
