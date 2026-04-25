import type { SupabaseClient } from '@supabase/supabase-js';
import {
  TASK_SELECT,
  coerceTaskRows,
  getVisibleTasks,
  hydrateTasks,
  type DisplayTask,
  type Task,
} from './taskModel';

export type TaskListScope = 'all' | 'scheduled' | 'completed' | 'inbox';
export type TaskStatusFilter = 'all' | 'active' | 'completed';
export type TaskDueFilter = 'all' | 'today' | 'overdue' | 'future' | 'scheduled' | 'unscheduled';

type QueryOptions = {
  userId: string;
  scope?: TaskListScope;
  projectId?: string | null;
  sectionId?: string | null;
  searchQuery?: string;
  status?: TaskStatusFilter;
  due?: TaskDueFilter;
};

function getLocalDayBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

export async function listTasks(
  supabase: SupabaseClient,
  {
    userId,
    scope = 'all',
    projectId,
    sectionId,
    searchQuery = '',
    status = 'all',
    due = 'all',
  }: QueryOptions
) {
  let query = supabase.from('tasks').select(TASK_SELECT).eq('user_id', userId);
  const normalizedSearch = searchQuery.trim().replaceAll('%', '\\%').replaceAll('_', '\\_');

  if (scope === 'scheduled') {
    query = query.not('due_at', 'is', null).order('due_at', { ascending: true });
  } else if (scope === 'completed') {
    query = query.eq('is_completed', true).order('completed_at', { ascending: false });
  } else if (scope === 'inbox') {
    query = query.is('project_id', null).order('sort_order', { ascending: false });
  } else {
    query = query.order('sort_order', { ascending: false });
  }

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  if (sectionId) {
    query = query.eq('section_id', sectionId);
  }

  if (normalizedSearch) {
    query = query.or(`title.ilike.%${normalizedSearch}%,notes.ilike.%${normalizedSearch}%`);
  }

  if (status === 'active') {
    query = query.eq('is_completed', false);
  } else if (status === 'completed') {
    query = query.eq('is_completed', true);
  }

  if (due !== 'all') {
    const { start, end } = getLocalDayBounds();

    if (due === 'scheduled') {
      query = query.not('due_at', 'is', null);
    } else if (due === 'unscheduled') {
      query = query.is('due_at', null);
    } else if (due === 'today') {
      query = query.gte('due_at', start).lte('due_at', end);
    } else if (due === 'overdue') {
      query = query.lt('due_at', start);
    } else if (due === 'future') {
      query = query.gt('due_at', end);
    }
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  return { data: getVisibleTasks(hydrateTasks(coerceTaskRows(data))), error };
}

export async function createTask(
  supabase: SupabaseClient,
  task: Omit<Partial<Task>, 'id' | 'created_at' | 'updated_at'> & Pick<Task, 'title' | 'user_id'>
) {
  const { data, error } = await supabase.from('tasks').insert(task).select(TASK_SELECT).single();
  const created = data ? hydrateTasks(coerceTaskRows([data]))[0] : null;
  return { data: created ?? null, error };
}

export async function updateTask(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  updates: Partial<Task>
) {
  return supabase.from('tasks').update(updates).eq('id', id).eq('user_id', userId);
}

export async function toggleTaskComplete(
  supabase: SupabaseClient,
  userId: string,
  task: Pick<DisplayTask, 'id' | 'is_completed'>
) {
  const nextStatus = !task.is_completed;
  const updates = {
    is_completed: nextStatus,
    completed_at: nextStatus ? new Date().toISOString() : null,
  };

  const { error } = await updateTask(supabase, userId, task.id, updates);
  return { updates, error };
}

export async function deleteTasks(supabase: SupabaseClient, userId: string, ids: string[]) {
  return supabase.from('tasks').delete().in('id', ids).eq('user_id', userId);
}
