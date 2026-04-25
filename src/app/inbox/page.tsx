'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { App, Button, Empty, Pagination, Skeleton, Spin } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useAuth, useUser } from '@clerk/nextjs';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClerkSupabaseClient } from '@/lib/supabaseClient';
import TodoItem, { type DisplayTask, type Task } from '@/components/TodoItem';
import { useI18n } from '@/components/I18nProvider';
import SignInPrompt from '@/components/SignInPrompt';
import {
  PROJECT_SELECT,
  SECTION_SELECT,
  coerceProjectRows,
  coerceSectionRows,
  filterTasksByScope,
  type Project,
  type Label,
  type Recurrence,
  type RecurrenceRule,
  type Reminder,
  type Section,
  type TaskLabel,
} from '@/lib/taskModel';
import { createTask, deleteTasks, listTasks, toggleTaskComplete, updateTask } from '@/lib/taskRepository';
import { advanceRecurringTask, listTaskMetadata, setTaskLabels, upsertRecurrence, upsertReminder } from '@/lib/taskMetadataRepository';

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="workspace-home"><Skeleton active paragraph={{ rows: 10 }} /></div>}>
      <InboxContent />
    </Suspense>
  );
}

function InboxContent() {
  const { t } = useI18n();
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const supabase = useMemo(() => createClerkSupabaseClient(getToken), [getToken]);
  const { message, notification } = App.useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q')?.trim() ?? '';
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
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  useEffect(() => {
    const fetchTasks = async () => {
      if (!isLoaded || !isSignedIn || !user) {
        setTasks([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const [{ data, error }, { data: projectData }, { data: sectionData }, metadata] = await Promise.all([
        listTasks(supabase, { userId: user.id, scope: 'inbox', searchQuery }),
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
  }, [isLoaded, isSignedIn, notification, searchQuery, supabase, t, user]);

  const filteredTasks = useMemo(
    () => filterTasksByScope(tasks, { searchQuery, inboxOnly: true }),
    [searchQuery, tasks]
  );

  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [currentPage, filteredTasks]);

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
        setTasks((prev) => prev.map((task) => (task.id === id ? { ...task, due_at: nextDueAt, is_completed: false, completed_at: null } : task)));
        const nextMetadata = await listTaskMetadata(supabase, user.id);
        setRecurrences(nextMetadata.recurrences);
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

    const nextMetadata = await listTaskMetadata(supabase, user.id);
    setLabels(nextMetadata.labels);
    setTaskLabelsState(nextMetadata.taskLabels);
    setReminders(nextMetadata.reminders);
    setRecurrences(nextMetadata.recurrences);
  };

  if (!isLoaded) {
    return (
      <section className="workspace-home">
        <div className="loading-shell">
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      </section>
    );
  }

  if (!isSignedIn) {
    return (
      <section className="workspace-home">
        <SignInPrompt />
      </section>
    );
  }

  return (
    <section className="workspace-home">
      <section className="hero-strip">
        <div>
          <span className="eyebrow secondary-label">{t('inbox')}</span>
          <h2 className="editorial-header">{t('inboxTitle')}</h2>
          <p>{t('inboxHeroDesc')}</p>
        </div>
        <div className="hero-stats">
          <div className="hero-stat-card bento-small">
            <strong className="editorial-header">{filteredTasks.length}</strong>
            <span className="secondary-label">{t('unprocessed')}</span>
          </div>
        </div>
      </section>

      <div className="section-heading">
        <div>
          <h3 className="editorial-header">{t('inbox')}</h3>
          <p>{searchQuery ? t('searchResultsFor', { query: searchQuery }) : t('inboxTasksDesc')}</p>
        </div>
      </div>

      <div className="task-list-surface">
        <Spin spinning={loading}>
          {loading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : filteredTasks.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('noInboxTasks')}>
              <Button type="primary" icon={<InboxOutlined />} onClick={() => router.push('/?focus=true')}>
                {t('addTask')}
              </Button>
            </Empty>
          ) : (
            <div className="task-list-stack">
              {paginatedTasks.map((task) => (
                <TodoItem
                  key={`${task.id}:${task.updated_at}`}
                  item={task}
                  togglingIds={togglingIds}
                  deletingIds={deletingIds}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onUpdate={handleUpdate}
                  onCreateSubtask={handleCreateSubtask}
                  onUpdateMetadata={handleUpdateMetadata}
                  projects={projects}
                  sections={sections}
                  parentCandidates={tasks}
                  labels={labels}
                  taskLabelIds={taskLabels.filter((label) => label.task_id === task.id).map((label) => label.label_id)}
                  reminder={reminders.find((reminder) => reminder.task_id === task.id) ?? null}
                  recurrence={recurrences.find((recurrence) => recurrence.task_id === task.id) ?? null}
                />
              ))}
              <div className="pagination-wrapper">
                <Pagination
                  current={currentPage}
                  pageSize={pageSize}
                  total={filteredTasks.length}
                  onChange={setCurrentPage}
                  hideOnSinglePage
                  showSizeChanger={false}
                  className="custom-pagination"
                />
              </div>
            </div>
          )}
        </Spin>
      </div>
    </section>
  );
}
