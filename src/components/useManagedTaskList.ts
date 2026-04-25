'use client';

import { App } from 'antd';
import { useAuth, useUser } from '@clerk/nextjs';
import { useEffect, useMemo, useState } from 'react';
import { useI18n } from './I18nProvider';
import { createClerkSupabaseClient } from '@/lib/supabaseClient';
import {
  PROJECT_SELECT,
  SECTION_SELECT,
  coerceProjectRows,
  coerceSectionRows,
  type DisplayTask,
  type Label,
  type Project,
  type Recurrence,
  type RecurrenceRule,
  type Reminder,
  type Section,
  type Task,
  type TaskLabel,
} from '@/lib/taskModel';
import {
  createTask,
  deleteTasks,
  listTasks,
  toggleTaskComplete,
  type TaskListScope,
  updateTask,
} from '@/lib/taskRepository';
import {
  advanceRecurringTask,
  listTaskMetadata,
  setTaskLabels,
  upsertRecurrence,
  upsertReminder,
} from '@/lib/taskMetadataRepository';

type UseManagedTaskListOptions = {
  scope?: TaskListScope;
  projectId?: string | null;
  sectionId?: string | null;
  searchQuery?: string;
};

export function useManagedTaskList({
  scope = 'all',
  projectId = null,
  sectionId = null,
  searchQuery = '',
}: UseManagedTaskListOptions = {}) {
  const { t } = useI18n();
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const supabase = useMemo(() => createClerkSupabaseClient(getToken), [getToken]);
  const { message, notification } = App.useApp();

  const [tasks, setTasks] = useState<DisplayTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [taskLabels, setTaskLabelsState] = useState<TaskLabel[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [recurrences, setRecurrences] = useState<Recurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const refreshMetadata = async () => {
    if (!user) {
      return;
    }

    const metadata = await listTaskMetadata(supabase, user.id);
    setLabels(metadata.labels);
    setTaskLabelsState(metadata.taskLabels);
    setReminders(metadata.reminders);
    setRecurrences(metadata.recurrences);
  };

  useEffect(() => {
    const fetchTasks = async () => {
      if (!isLoaded || !isSignedIn || !user) {
        setTasks([]);
        setProjects([]);
        setSections([]);
        setLabels([]);
        setTaskLabelsState([]);
        setReminders([]);
        setRecurrences([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const [{ data, error }, { data: projectData }, { data: sectionData }, metadata] = await Promise.all([
        listTasks(supabase, {
          userId: user.id,
          scope,
          projectId,
          sectionId,
          searchQuery,
        }),
        supabase.from('projects').select(PROJECT_SELECT).eq('user_id', user.id).eq('is_archived', false),
        supabase.from('sections').select(SECTION_SELECT).eq('user_id', user.id),
        listTaskMetadata(supabase, user.id),
      ]);

      if (error) {
        notification.error({ title: t('loadTasksFailed'), description: error.message });
      } else {
        setTasks(data);
      }

      setProjects(coerceProjectRows(projectData));
      setSections(coerceSectionRows(sectionData));
      setLabels(metadata.labels);
      setTaskLabelsState(metadata.taskLabels);
      setReminders(metadata.reminders);
      setRecurrences(metadata.recurrences);
      setLoading(false);
    };

    void fetchTasks();
  }, [isLoaded, isSignedIn, notification, projectId, scope, searchQuery, sectionId, supabase, t, user]);

  const handleToggle = async (id: string) => {
    if (!user) {
      return;
    }

    const target = tasks.find((task) => task.id === id);
    if (!target) {
      return;
    }

    setTogglingIds((prev) => new Set(prev).add(id));
    const recurrence = recurrences.find((item) => item.task_id === id);

    if (!target.is_completed && recurrence?.rule && ['daily', 'weekly', 'weekdays'].includes(recurrence.rule)) {
      const { nextDueAt, error } = await advanceRecurringTask(
        supabase,
        user.id,
        id,
        recurrence.rule as RecurrenceRule,
        target.due_at
      );

      if (error) {
        notification.error({ title: t('statusUpdateFailed'), description: error.message });
      } else {
        setTasks((prev) =>
          prev.map((task) => (task.id === id ? { ...task, due_at: nextDueAt, is_completed: false, completed_at: null } : task))
        );
        await refreshMetadata();
        message.success(t('recurringAdvanced'));
      }

      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }

    const { updates, error } = await toggleTaskComplete(supabase, user.id, target);
    if (error) {
      notification.error({ title: t('statusUpdateFailed'), description: error.message });
    } else {
      setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...updates } : task)));
    }

    setTogglingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    if (!user) {
      return;
    }

    setDeletingIds((prev) => new Set(prev).add(id));
    const { error } = await deleteTasks(supabase, user.id, [id]);

    if (error) {
      notification.error({ title: t('deleteFailed'), description: error.message });
    } else {
      setTasks((prev) => prev.filter((task) => task.id !== id));
      message.success(t('deleteSuccess'));
    }

    setDeletingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleUpdate = async (id: string, updates: Partial<Task>) => {
    if (!user) {
      return;
    }

    const { error } = await updateTask(supabase, user.id, id, updates);
    if (error) {
      notification.error({ title: t('updateFailed'), description: error.message });
      return;
    }

    setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, ...updates } : task)));
  };

  const handleCreateSubtask = async (parent: DisplayTask, title: string) => {
    if (!user) {
      return;
    }

    const { data, error } = await createTask(supabase, {
      title,
      notes: '',
      is_completed: false,
      priority: parent.priority,
      user_id: user.id,
      project_id: parent.project_id,
      section_id: parent.section_id,
      parent_id: parent.id,
      due_at: parent.due_at,
      completed_at: null,
      sort_order: Date.now(),
      source: 'manual',
    });

    if (error) {
      notification.error({ title: t('addFailed'), description: error.message });
      return;
    }

    setTasks((prev) => (data ? [data, ...prev] : prev));
    message.success(t('taskAdded'));
  };

  const handleUpdateMetadata = async (
    task: DisplayTask,
    metadata: { labelIds?: string[]; reminderAt?: string | null; recurrenceRule?: RecurrenceRule | null }
  ) => {
    if (!user) {
      return;
    }

    const [labelResult, reminderResult, recurrenceResult] = await Promise.all([
      metadata.labelIds ? setTaskLabels(supabase, user.id, task.id, metadata.labelIds) : Promise.resolve({ error: null }),
      metadata.reminderAt !== undefined ? upsertReminder(supabase, user.id, task.id, metadata.reminderAt) : Promise.resolve({ error: null }),
      metadata.recurrenceRule !== undefined
        ? upsertRecurrence(supabase, user.id, task.id, metadata.recurrenceRule, task.due_at)
        : Promise.resolve({ error: null }),
    ]);

    const error = labelResult.error || reminderResult.error || recurrenceResult.error;
    if (error) {
      notification.error({ title: t('updateFailed'), description: error.message });
      return;
    }

    await refreshMetadata();
  };

  return {
    isLoaded,
    isSignedIn,
    user,
    supabase,
    tasks,
    setTasks,
    projects,
    sections,
    labels,
    taskLabels,
    reminders,
    recurrences,
    loading,
    togglingIds,
    deletingIds,
    refreshMetadata,
    handleToggle,
    handleDelete,
    handleUpdate,
    handleCreateSubtask,
    handleUpdateMetadata,
  };
}
