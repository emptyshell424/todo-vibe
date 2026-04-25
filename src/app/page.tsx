'use client';

import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  App,
  Button,
  Empty,
  Input,
  type InputRef,
  Pagination,
  Progress,
  Select,
  Segmented,
  Skeleton,
  Spin,
  Tabs,
} from 'antd';
import { DatePicker } from 'antd';
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FireOutlined,
  PlusOutlined,
  RobotOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { useAuth, useUser } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { createClerkSupabaseClient } from '@/lib/supabaseClient';
import TodoItem, { type DisplayTask, type Task } from '@/components/TodoItem';
import { useI18n } from '@/components/I18nProvider';
import SignInPrompt from '@/components/SignInPrompt';
import { getApiErrorMessage } from '@/lib/api';
import {
  TASK_SELECT,
  coerceTaskRows,
  coerceProjectRows,
  coerceSectionRows,
  filterTasksByScope,
  getDateGroupKey,
  getVisibleTasks,
  hydrateTasks,
  isTaskAfterToday,
  isTaskInTodayScope,
  type Label,
  PROJECT_SELECT,
  type Recurrence,
  type RecurrenceRule,
  type Reminder,
  SECTION_SELECT,
  type Project,
  type Section,
  type TaskLabel,
  type TaskPriority,
} from '@/lib/taskModel';
import { createTask, deleteTasks, listTasks, toggleTaskComplete, updateTask } from '@/lib/taskRepository';
import { advanceRecurringTask, listTaskMetadata, setTaskLabels, upsertRecurrence, upsertReminder } from '@/lib/taskMetadataRepository';
import { parseQuickTasks } from '@/lib/quickAdd';

type AiBreakdownTask = {
  title: string;
  priority: 'high' | 'medium' | 'low';
};

type TodoListEntry =
  | { type: 'single'; task: DisplayTask }
  | { type: 'group'; key: string; title: string; tasks: DisplayTask[] };

const INBOX_PROJECT_SELECT_VALUE = '__inbox__';
const NO_SECTION_SELECT_VALUE = '__no_section__';

function isValidAiBreakdownTasks(value: unknown): value is AiBreakdownTask[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (item) =>
        !!item &&
        typeof item === 'object' &&
        typeof (item as AiBreakdownTask).title === 'string' &&
        (item as AiBreakdownTask).title.trim().length > 0 &&
        ['high', 'medium', 'low'].includes((item as AiBreakdownTask).priority)
    )
  );
}

function priorityFromAi(priority: AiBreakdownTask['priority']): TaskPriority {
  switch (priority) {
    case 'high':
      return 4;
    case 'medium':
      return 3;
    default:
      return 1;
  }
}

function prioritySegmentOptions() {
  return [
    { label: 'P1', value: 4 },
    { label: 'P2', value: 3 },
    { label: 'P3', value: 2 },
    { label: 'P4', value: 1 },
  ];
}

function computeStreakDays(tasks: DisplayTask[]) {
  const completionDays = new Set(
    tasks
      .filter((task) => task.is_completed)
      .map((task) => getDateGroupKey(task.completed_at ?? task.updated_at ?? task.created_at))
  );

  let streak = 0;
  const cursor = new Date();

  while (completionDays.has(getDateGroupKey(cursor.toISOString()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export default function Home() {
  return (
    <Suspense fallback={<div className="workspace-home"><Skeleton active paragraph={{ rows: 10 }} /></div>}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const { t } = useI18n();
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const supabase = useMemo(() => createClerkSupabaseClient(getToken), [getToken]);
  const { message, notification, modal } = App.useApp();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q')?.trim() ?? '';
  const inputRef = useRef<InputRef>(null);

  const [tasks, setTasks] = useState<DisplayTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [taskLabels, setTaskLabelsState] = useState<TaskLabel[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [recurrences, setRecurrences] = useState<Recurrence[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('all');
  const [breakingDown, setBreakingDown] = useState(false);
  const [newPriority, setNewPriority] = useState<TaskPriority>(1);
  const [scheduledDate, setScheduledDate] = useState<string | null>(null);
  const [composerProjectId, setComposerProjectId] = useState<string | null>(null);
  const [composerSectionId, setComposerSectionId] = useState<string | null>(null);
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());
  const [pages, setPages] = useState<Record<string, number>>({});
  const pageSize = 10;

  const pageKey = `${activeTab}:${searchQuery}`;
  const currentPage = pages[pageKey] ?? 1;

  const scopedTasks = tasks;

  const todayTasks = useMemo(() => scopedTasks.filter((task) => isTaskInTodayScope(task)), [scopedTasks]);

  const tabFilteredTasks = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return todayTasks.filter((task) => !task.is_completed);
      case 'completed':
        return todayTasks.filter((task) => task.is_completed);
      default:
        return todayTasks;
    }
  }, [activeTab, todayTasks]);

  const filteredTasks = useMemo(
    () => filterTasksByScope(tabFilteredTasks, { searchQuery }),
    [searchQuery, tabFilteredTasks]
  );

  const allTodoListEntries = useMemo<TodoListEntry[]>(() => {
    const entries: TodoListEntry[] = [];
    const groupIndexByParentId = new Map<string, number>();
    const taskIdsWithChildren = new Set(filteredTasks.map((task) => task.parent_id).filter(Boolean));

    for (const task of filteredTasks) {
      if (task.source === 'ai_plan' && taskIdsWithChildren.has(task.id)) {
        continue;
      }

      if (task.parent_id && task.parentTitle) {
        const existingEntryIndex = groupIndexByParentId.get(task.parent_id);
        if (existingEntryIndex !== undefined) {
          const existingEntry = entries[existingEntryIndex];
          if (existingEntry.type === 'group') {
            existingEntry.tasks.push(task);
          }
          continue;
        }

        groupIndexByParentId.set(task.parent_id, entries.length);
        entries.push({
          type: 'group',
          key: task.parent_id,
          title: task.parentTitle,
          tasks: [task],
        });
        continue;
      }

      entries.push({ type: 'single', task });
    }

    return entries;
  }, [filteredTasks]);

  const todoListEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return allTodoListEntries.slice(start, start + pageSize);
  }, [allTodoListEntries, currentPage]);

  const totalCount = todayTasks.length;
  const completedCount = todayTasks.filter((task) => task.is_completed).length;
  const activeCount = totalCount - completedCount;
  const focusScore = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const groupedEntries = allTodoListEntries.filter((entry) => entry.type === 'group');
  const streakDays = computeStreakDays(tasks);

  const tomorrowPreview = useMemo(
    () => scopedTasks.filter((task) => !task.is_completed && isTaskAfterToday(task)).slice(0, 3),
    [scopedTasks]
  );

  useEffect(() => {
    if (searchParams.get('focus') === 'true') {
      inputRef.current?.focus();
    }
  }, [searchParams]);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!isLoaded || !isSignedIn || !user) {
        setTasks([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const [{ data, error }, { data: projectData }, { data: sectionData }, metadata] = await Promise.all([
        listTasks(supabase, { userId: user.id }),
        supabase.from('projects').select(PROJECT_SELECT).eq('user_id', user.id).eq('is_archived', false),
        supabase.from('sections').select(SECTION_SELECT).eq('user_id', user.id),
        listTaskMetadata(supabase, user.id),
      ]);

      if (error) {
        notification.error({
          title: t('loadTasksFailed'),
          description: error.message,
          placement: 'topRight',
        });
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
  }, [isLoaded, isSignedIn, notification, supabase, t, user]);

  const setCurrentPage = (page: number) => {
    setPages((prev) => ({ ...prev, [pageKey]: page }));
  };

  const toggleGroupCollapsed = (groupId: string) => {
    setCollapsedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const resetComposer = () => {
    setInputValue('');
    setNewPriority(1);
    setScheduledDate(null);
    setComposerProjectId(null);
    setComposerSectionId(null);
    setCurrentPage(1);
  };

  const handleAdd = async () => {
    const parsedTasks = parseQuickTasks(inputValue);
    if (parsedTasks.length === 0) {
      message.warning(t('writeSomethingFirst'));
      return;
    }

    if (!user) {
      return;
    }

    setAdding(true);

    const createdTasks: DisplayTask[] = [];
    let firstError: string | null = null;

    for (const [index, parsedTask] of parsedTasks.entries()) {
      const { data, error } = await createTask(supabase, {
        title: parsedTask.title,
        notes: '',
        is_completed: false,
        priority: parsedTask.priority || newPriority,
        user_id: user.id,
        project_id: composerProjectId,
        section_id: composerSectionId,
        due_at: scheduledDate ?? parsedTask.due_at,
        completed_at: null,
        sort_order: Date.now() - index,
        source: 'manual',
      });

      if (error) {
        firstError = error.message;
        break;
      }

      if (data) {
        createdTasks.push(data);
        if (parsedTask.recurrenceRule) {
          await upsertRecurrence(supabase, user.id, data.id, parsedTask.recurrenceRule, data.due_at);
        }
      }
    }

    if (firstError) {
      notification.error({
        title: t('addFailed'),
        description: firstError,
        placement: 'topRight',
      });
    } else {
      setTasks((prev) => [...createdTasks, ...prev]);
      resetComposer();
      message.success(t('tasksAdded', { count: createdTasks.length }));
      inputRef.current?.focus();
      if (createdTasks.some((task) => task.id)) {
        const nextMetadata = await listTaskMetadata(supabase, user.id);
        setRecurrences(nextMetadata.recurrences);
      }
    }

    setAdding(false);
  };

  const handleAiBreakdown = async () => {
    if (breakingDown) {
      return;
    }

    const goal = inputValue.trim();
    if (!goal) {
      message.warning(t('aiGoalPrompt'));
      return;
    }

    if (!user) {
      return;
    }

    setBreakingDown(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const apiKey = localStorage.getItem('gemini_api_key') || '';
      const provider = localStorage.getItem('ai_provider') || 'gemini';
      const baseUrl = localStorage.getItem('ai_base_url') || '';
      const model = localStorage.getItem('ai_model') || '';

      if (!apiKey) {
        notification.error({
          title: t('aiFailed'),
          description: t('missingApiKey'),
          placement: 'topRight',
        });
        setBreakingDown(false);
        return;
      }

      const response = await fetch('/api/ai/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, apiKey, provider, baseUrl, model }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(getApiErrorMessage(errorData, t('aiFailed')));
      }

      const aiTasks: unknown = await response.json();
      if (!isValidAiBreakdownTasks(aiTasks)) {
        throw new Error(t('aiInvalidFormat'));
      }

      const parentSortOrder = Date.now();
      const { data: parentTask, error: parentError } = await supabase
        .from('tasks')
        .insert({
          title: goal,
          notes: '',
          is_completed: false,
          priority: 3,
          user_id: user.id,
          project_id: composerProjectId,
          section_id: composerSectionId,
          due_at: scheduledDate,
          completed_at: null,
          sort_order: parentSortOrder,
          source: 'ai_plan',
        })
        .select(TASK_SELECT)
        .single();

      if (parentError || !parentTask) {
        throw parentError ?? new Error('Failed to create AI parent task.');
      }

      const parentTaskRow = coerceTaskRows([parentTask])[0];
      if (!parentTaskRow) {
        throw new Error('Failed to normalize AI parent task.');
      }

      const childRows = aiTasks.map((task, index) => ({
        title: task.title.trim(),
        notes: '',
        is_completed: false,
        priority: priorityFromAi(task.priority),
        user_id: user.id,
        project_id: composerProjectId,
        section_id: composerSectionId,
        due_at: scheduledDate,
        completed_at: null,
        sort_order: parentSortOrder - index - 1,
        source: 'ai_breakdown',
        parent_id: String(parentTaskRow.id),
      }));

      const { data, error } = await supabase.from('tasks').insert(childRows).select(TASK_SELECT);

      if (error || !data) {
        await supabase.from('tasks').delete().eq('id', String(parentTaskRow.id)).eq('user_id', user.id);
        throw error ?? new Error('Failed to create AI subtasks.');
      }

      const hydrated = hydrateTasks(coerceTaskRows([parentTaskRow, ...data]));
      setTasks((prev) => [...getVisibleTasks(hydrated), ...prev]);
      resetComposer();
      message.success(t('aiSuccess'));
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        notification.warning({
          title: t('aiTimeout'),
          description: t('aiTimeout'),
          placement: 'topRight',
        });
      } else {
        notification.error({
          title: t('aiFailed'),
          description: error instanceof Error ? error.message : t('aiFailed'),
          placement: 'topRight',
        });
      }
    } finally {
      clearTimeout(timeoutId);
      setBreakingDown(false);
    }
  };

  const toggleComplete = async (id: string) => {
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
        notification.error({
          title: t('statusUpdateFailed'),
          description: error.message,
          placement: 'topRight',
        });
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
      notification.error({
        title: t('statusUpdateFailed'),
        description: error.message,
        placement: 'topRight',
      });
    } else {
      setTasks((prev) =>
        prev.map((task) => (task.id === id ? { ...task, ...updates } : task))
      );
    }

    setTogglingIds((prev) => {
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
      notification.error({
        title: t('updateFailed'),
        description: error.message,
        placement: 'topRight',
      });
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
      notification.error({
        title: t('addFailed'),
        description: error.message,
        placement: 'topRight',
      });
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
      notification.error({ title: t('updateFailed'), description: error.message, placement: 'topRight' });
      return;
    }

    const nextMetadata = await listTaskMetadata(supabase, user.id);
    setLabels(nextMetadata.labels);
    setTaskLabelsState(nextMetadata.taskLabels);
    setReminders(nextMetadata.reminders);
    setRecurrences(nextMetadata.recurrences);
  };

  const handleClearCompleted = () => {
    const completedIds = todayTasks.filter((task) => task.is_completed).map((task) => task.id);
    if (completedIds.length === 0) {
      return;
    }

    modal.confirm({
      title: t('clearCompletedTitle'),
      content: t('clearCompletedConfirm', { count: completedIds.length }),
      okText: t('clearCompletedOk'),
      okType: 'danger',
      onOk: async () => {
        if (!user) {
          return;
        }

        const { error } = await deleteTasks(supabase, user.id, completedIds);

        if (error) {
          notification.error({ title: t('clearCompleted'), description: error.message });
        } else {
          setTasks((prev) => prev.filter((task) => !completedIds.includes(task.id)));
          message.success(t('clearCompletedSuccess'));
        }
      },
    });
  };

  const handleDelete = (id: string) => {
    modal.confirm({
      title: t('deleteTaskTitle'),
      icon: <ExclamationCircleOutlined />,
      content: t('deleteTaskDesc'),
      okText: t('deleteOk'),
      okType: 'danger',
      cancelText: t('cancel'),
      onOk: async () => {
        if (!user) {
          return;
        }

        const target = tasks.find((task) => task.id === id);
        const relatedIds = [id];

        if (target?.parent_id) {
          const siblingCount = tasks.filter((task) => task.parent_id === target.parent_id).length;
          if (siblingCount === 1) {
            relatedIds.push(target.parent_id);
          }
        }

        setDeletingIds((prev) => new Set(prev).add(id));

        const { error } = await deleteTasks(supabase, user.id, relatedIds);

        if (error) {
          notification.error({
            title: t('deleteFailed'),
            description: error.message,
            placement: 'topRight',
          });
        } else {
          setTasks((prev) => prev.filter((task) => !relatedIds.includes(task.id)));
          message.success(t('deleteSuccess'));
        }

        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      },
    });
  };

  const renderTaskRow = (item: DisplayTask) => (
    <TodoItem
      key={`${item.id}:${item.updated_at}`}
      item={item}
      togglingIds={togglingIds}
      deletingIds={deletingIds}
      onToggle={toggleComplete}
      onDelete={handleDelete}
      onUpdate={handleUpdate}
      onCreateSubtask={handleCreateSubtask}
      onUpdateMetadata={handleUpdateMetadata}
      projects={projects}
      sections={sections}
      parentCandidates={tasks}
      labels={labels}
      taskLabelIds={taskLabels.filter((label) => label.task_id === item.id).map((label) => label.label_id)}
      reminder={reminders.find((reminder) => reminder.task_id === item.id) ?? null}
      recurrence={recurrences.find((recurrence) => recurrence.task_id === item.id) ?? null}
    />
  );

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

  const sectionOptions = sections.filter((section) => section.project_id === composerProjectId);

  return (
    <section className="workspace-home">
      <section className="hero-strip">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="hero-copy"
        >
          <span className="eyebrow secondary-label">{t('todayDashboard')}</span>
          <h2 className="editorial-header">
            {t('goodMorning')}
            {user?.username || user?.firstName || t('friend')}
          </h2>
        </motion.div>

        <div className="hero-stats">
          <motion.div
            className="hero-stat-card bento-small"
            whileHover={{ scale: 1.05, y: -5 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <strong className="editorial-header">{focusScore}%</strong>
            <span className="secondary-label">{t('focusScore')}</span>
          </motion.div>
          <motion.div
            className="hero-stat-card soft bento-small"
            whileHover={{ scale: 1.05, y: -5 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            <strong className="editorial-header">{streakDays}</strong>
            <span className="secondary-label">{t('days')}</span>
          </motion.div>
        </div>
      </section>

      <motion.section
        className="composer-panel floating"
        initial={{ y: 30, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{
          type: 'spring',
          stiffness: 260,
          damping: 20,
          delay: 0.2,
        }}
        whileHover={{ scale: 1.005 }}
      >
        <AnimatePresence>
          {breakingDown && (
            <motion.div className="ai-progress-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="ai-progress-shimmer" />
              <div className="ai-progress-pulse" />
              <span className="ai-progress-label">{t('aiThinking')}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="composer-entry">
          <div className="composer-icon">
            <ThunderboltOutlined />
          </div>

          <Input.TextArea
            ref={inputRef}
            className="composer-input"
            variant="borderless"
            placeholder={t('composerPlaceholder')}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            onPressEnter={(event) => {
              if (!event.shiftKey) {
                event.preventDefault();
                void handleAdd();
              }
            }}
            autoSize={{ minRows: 1, maxRows: 5 }}
            disabled={adding || breakingDown}
          />
        </div>

        <div className="composer-actions">
          <Select
            value={composerProjectId ?? INBOX_PROJECT_SELECT_VALUE}
            onChange={(value) => {
              const nextProjectId = value === INBOX_PROJECT_SELECT_VALUE ? null : String(value);
              setComposerProjectId(nextProjectId);
              setComposerSectionId(null);
            }}
            options={[
              { label: t('inboxProject'), value: INBOX_PROJECT_SELECT_VALUE },
              ...projects.map((project) => ({ label: project.name, value: project.id })),
            ]}
            placeholder={t('chooseProject')}
            style={{ minWidth: 140 }}
            allowClear
            disabled={adding || breakingDown}
          />
          <Select
            value={composerSectionId ?? NO_SECTION_SELECT_VALUE}
            onChange={(value) => {
              setComposerSectionId(value === NO_SECTION_SELECT_VALUE ? null : String(value));
            }}
            options={[
              { label: t('noSection'), value: NO_SECTION_SELECT_VALUE },
              ...sectionOptions.map((section) => ({ label: section.name, value: section.id })),
            ]}
            placeholder={t('chooseSection')}
            style={{ minWidth: 140 }}
            allowClear
            disabled={adding || breakingDown || !composerProjectId}
          />
          <Segmented
            options={prioritySegmentOptions()}
            value={newPriority}
            onChange={(value) => setNewPriority(value as TaskPriority)}
            disabled={adding || breakingDown}
          />
          <DatePicker
            value={scheduledDate ? dayjs(scheduledDate) : null}
            onChange={(value: Dayjs | null) => setScheduledDate(value ? value.startOf('day').toISOString() : null)}
            allowClear
            placeholder={t('scheduleOptional')}
            disabled={adding || breakingDown}
          />
          <Button
            size="large"
            type="text"
            icon={<RobotOutlined />}
            onClick={handleAiBreakdown}
            loading={breakingDown}
            disabled={adding || breakingDown}
            title={t('aiBreakdown')}
            className="composer-ai-btn"
          />
          <motion.div whileTap={{ scale: 0.96 }} transition={{ type: 'spring', stiffness: 400, damping: 10 }}>
            <Button
              type="primary"
              size="large"
              icon={<PlusOutlined />}
              onClick={handleAdd}
              loading={adding}
              disabled={breakingDown}
            >
              {t('addTask')}
            </Button>
          </motion.div>
        </div>
      </motion.section>

      <div className="workspace-grid">
        <section className="tasks-column">
          <div className="section-heading">
            <div>
              <h3 className="editorial-header">{t('today')}</h3>
              <p>{t('todayTasksDesc')}</p>
            </div>
            <div className="filter-pills">
              {[
                { key: 'all', label: `${t('all')} ${totalCount}` },
                { key: 'active', label: `${t('inProgress')} ${activeCount}` },
                { key: 'completed', label: `${t('completed')} ${completedCount}` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={activeTab === tab.key ? 'filter-pill active' : 'filter-pill'}
                  onClick={() => {
                    setActiveTab(tab.key as typeof activeTab);
                    setCurrentPage(1);
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {completedCount > 0 && (
              <Button type="text" danger size="small" onClick={handleClearCompleted}>
                {t('clearCompleted')}
              </Button>
            )}
          </div>

          <div className="task-list-surface">
            <Spin spinning={loading}>
              <AnimatePresence mode="popLayout" initial={false}>
                {loading ? (
                  <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Skeleton active paragraph={{ rows: 6 }} />
                  </motion.div>
                ) : filteredTasks.length === 0 ? (
                  <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={
                        activeTab === 'all'
                          ? t('noTasksTitle')
                          : activeTab === 'active'
                            ? t('noActiveTasks')
                            : t('noCompletedTasks')
                      }
                    >
                      {activeTab === 'all' && (
                        <Button type="primary" onClick={() => inputRef.current?.focus()}>
                          {t('startAdding')}
                        </Button>
                      )}
                    </Empty>
                  </motion.div>
                ) : (
                  <motion.div key="list" className="task-list-stack">
                    {todoListEntries.map((entry) => {
                      if (entry.type === 'single') {
                        return renderTaskRow(entry.task);
                      }

                      return (
                        <motion.section layout key={entry.key} className="task-group">
                          <div className="task-group-head">
                            <div>
                              <span className="eyebrow secondary-label">{t('aiBreakdownTag')}</span>
                              <h4 className="editorial-header" style={{ fontSize: '1.4rem' }}>{entry.title}</h4>
                            </div>
                            <Button type="text" size="small" onClick={() => toggleGroupCollapsed(entry.key)}>
                              {collapsedGroupIds.has(entry.key) ? t('expand') : t('collapse')}
                            </Button>
                          </div>
                          {!collapsedGroupIds.has(entry.key) && (
                            <div className="task-group-list">{entry.tasks.map((task) => renderTaskRow(task))}</div>
                          )}
                        </motion.section>
                      );
                    })}
                    <div className="pagination-wrapper">
                      <Pagination
                        current={currentPage}
                        pageSize={pageSize}
                        total={allTodoListEntries.length}
                        onChange={setCurrentPage}
                        hideOnSinglePage
                        showSizeChanger={false}
                        className="custom-pagination"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Spin>
          </div>
        </section>

        <aside className="insight-column">
          <section className="dashboard-card bento-glow">
            <Tabs
              defaultActiveKey="1"
              items={[
                {
                  key: '1',
                  label: t('overviewTitle'),
                  children: (
                    <div className="tab-pane">
                      <div className="metric-stack">
                        <div className="metric-row">
                          <span>{t('dailyCompletion')}</span>
                          <strong>{focusScore}%</strong>
                        </div>
                        <Progress percent={focusScore} showInfo={false} strokeColor="#006592" railColor="#dde3eb" />
                        <div className="metric-grid">
                          <div>
                            <strong>{totalCount}</strong>
                            <span>{t('allTasks')}</span>
                          </div>
                          <div>
                            <strong>{activeCount}</strong>
                            <span>{t('inProgress')}</span>
                          </div>
                          <div>
                            <strong>{completedCount}</strong>
                            <span>{t('completed')}</span>
                          </div>
                          <div>
                            <strong>{groupedEntries.length}</strong>
                            <span>{t('aiGroups')}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ),
                },
                {
                  key: '2',
                  label: t('nextHorizonTitle'),
                  children: (
                    <div className="tab-pane">
                      <p className="tab-desc">{t('nextHorizonDesc')}</p>
                      <div className="tomorrow-list">
                        {tomorrowPreview.length === 0 ? (
                          <p className="placeholder-copy">{t('placeholderPreview')}</p>
                        ) : (
                          tomorrowPreview.map((task, index) => (
                            <div key={task.id} className="tomorrow-item">
                              <span className="tomorrow-dot" />
                              <div>
                                <p>{task.title}</p>
                                <span>{index === 0 ? t('topPriority') : t('nextBridge')}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ),
                },
                {
                  key: '3',
                  label: t('ritual'),
                  children: (
                    <div className="tab-pane">
                      <div className="wisdom-mini">
                        <FireOutlined />
                        <p>{t('wisdomQuote')}</p>
                      </div>
                      <div className="mini-stats-row">
                        <div className="mini-stat-item">
                          <CheckCircleOutlined />
                          <strong>{completedCount}</strong>
                        </div>
                        <div className="mini-stat-item">
                          <RobotOutlined />
                          <strong>{groupedEntries.length}</strong>
                        </div>
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </section>
        </aside>
      </div>
    </section>
  );
}
