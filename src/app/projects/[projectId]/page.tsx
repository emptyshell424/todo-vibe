'use client';

import React, { Suspense, use, useEffect, useMemo, useState } from 'react';
import { App, Button, Empty, Input, Pagination, Select, Skeleton, Spin } from 'antd';
import { FolderOpenOutlined, PlusOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import TodoItem from '@/components/TodoItem';
import { useI18n } from '@/components/I18nProvider';
import SignInPrompt from '@/components/SignInPrompt';
import { useManagedTaskList } from '@/components/useManagedTaskList';
import { parseQuickTasks } from '@/lib/quickAdd';
import { type DisplayTask, type TaskPriority } from '@/lib/taskModel';
import { createTask } from '@/lib/taskRepository';
import { upsertRecurrence } from '@/lib/taskMetadataRepository';

const NO_SECTION_SELECT_VALUE = '__no_section__';
const ALL_SECTIONS_FILTER_VALUE = '__all_sections__';

export default function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  return (
    <Suspense fallback={<div className="workspace-home"><Skeleton active paragraph={{ rows: 10 }} /></div>}>
      <ProjectContent params={params} />
    </Suspense>
  );
}

function ProjectContent({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { message, notification } = App.useApp();
  const { projectId } = use(params);
  const resolvedProjectId = decodeURIComponent(projectId);
  const searchQuery = searchParams.get('q')?.trim() ?? '';
  const selectedSectionId = searchParams.get('section');
  const [adding, setAdding] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [newPriority, setNewPriority] = useState<TaskPriority>(1);
  const [composerSectionId, setComposerSectionId] = useState<string | null>(selectedSectionId);
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('all');
  const [pages, setPages] = useState<Record<string, number>>({});
  const pageSize = 12;

  useEffect(() => {
    setComposerSectionId(selectedSectionId);
  }, [selectedSectionId]);

  const {
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
  } = useManagedTaskList({
    projectId: resolvedProjectId,
    sectionId: selectedSectionId,
    searchQuery,
  });

  const project = useMemo(
    () => projects.find((candidate) => candidate.id === resolvedProjectId) ?? null,
    [projects, resolvedProjectId]
  );
  const projectSections = useMemo(
    () => sections.filter((section) => section.project_id === resolvedProjectId),
    [resolvedProjectId, sections]
  );

  const tabFilteredTasks = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return tasks.filter((task) => !task.is_completed);
      case 'completed':
        return tasks.filter((task) => task.is_completed);
      default:
        return tasks;
    }
  }, [activeTab, tasks]);

  const pageKey = `${resolvedProjectId ?? 'unknown'}:${selectedSectionId ?? 'all'}:${searchQuery}:${activeTab}`;
  const currentPage = pages[pageKey] ?? 1;
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return tabFilteredTasks.slice(start, start + pageSize);
  }, [currentPage, tabFilteredTasks]);

  const setCurrentPage = (page: number) => {
    setPages((prev) => ({ ...prev, [pageKey]: page }));
  };

  const resetComposer = () => {
    setInputValue('');
    setNewPriority(1);
    setComposerSectionId(selectedSectionId);
  };

  const handleAdd = async () => {
    const parsedTasks = parseQuickTasks(inputValue);
    if (parsedTasks.length === 0) {
      message.warning(t('writeSomethingFirst'));
      return;
    }

    if (!user || !resolvedProjectId) {
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
        project_id: resolvedProjectId,
        section_id: composerSectionId,
        due_at: parsedTask.due_at,
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

    if (createdTasks.length > 0) {
      setTasks((prev) => [...createdTasks, ...prev]);
      await refreshMetadata();
      resetComposer();
      message.success(t('tasksAdded', { count: createdTasks.length }));
    }

    if (firstError) {
      notification.error({ title: t('addFailed'), description: firstError });
    }

    setAdding(false);
  };

  const handleSectionFilterChange = (value: string) => {
    if (!resolvedProjectId) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    if (value === ALL_SECTIONS_FILTER_VALUE) {
      params.delete('section');
    } else {
      params.set('section', value);
    }

    const nextPath = params.toString() ? `/projects/${resolvedProjectId}?${params.toString()}` : `/projects/${resolvedProjectId}`;
    router.push(nextPath);
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

  if (!loading && !project) {
    return (
      <section className="workspace-home">
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('projectNotFound')} />
      </section>
    );
  }

  return (
    <section className="workspace-home">
      <section className="hero-strip">
        <div>
          <span className="eyebrow secondary-label">{t('projects')}</span>
          <h2 className="editorial-header">{project?.name ?? t('projects')}</h2>
          <p>{t('projectTasksDesc')}</p>
        </div>
        <div className="hero-stats">
          <div className="hero-stat-card bento-small">
            <strong className="editorial-header">{tabFilteredTasks.length}</strong>
            <span className="secondary-label">{t('taskCount', { count: tabFilteredTasks.length })}</span>
          </div>
        </div>
      </section>

      <section className="composer-panel floating">
        <div className="composer-entry">
          <div className="composer-icon">
            <FolderOpenOutlined />
          </div>
          <Input.TextArea
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
            disabled={adding}
          />
        </div>

        <div className="composer-actions">
          <Select
            value={composerSectionId ?? NO_SECTION_SELECT_VALUE}
            onChange={(value) => {
              setComposerSectionId(value === NO_SECTION_SELECT_VALUE ? null : String(value));
            }}
            options={[
              { label: t('noSection'), value: NO_SECTION_SELECT_VALUE },
              ...projectSections.map((section) => ({ label: section.name, value: section.id })),
            ]}
            placeholder={t('chooseSection')}
            style={{ minWidth: 160 }}
            disabled={adding}
          />
          <Select
            value={newPriority}
            onChange={(value) => setNewPriority(value as TaskPriority)}
            options={[
              { label: 'P1', value: 4 },
              { label: 'P2', value: 3 },
              { label: 'P3', value: 2 },
              { label: 'P4', value: 1 },
            ]}
            style={{ width: 120 }}
            disabled={adding}
          />
          <Button type="primary" size="large" icon={<PlusOutlined />} onClick={handleAdd} loading={adding}>
            {t('addTask')}
          </Button>
        </div>
      </section>

      <div className="section-heading">
        <div>
          <h3 className="editorial-header">{project?.name ?? t('projects')}</h3>
          <p>{searchQuery ? t('searchResultsFor', { query: searchQuery }) : t('projectTasksDesc')}</p>
        </div>
        <div className="filter-pills" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { key: 'all', label: `${t('all')} ${tasks.length}` },
            { key: 'active', label: `${t('inProgress')} ${tasks.filter((task) => !task.is_completed).length}` },
            { key: 'completed', label: `${t('completed')} ${tasks.filter((task) => task.is_completed).length}` },
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
          <Select
            value={selectedSectionId ?? ALL_SECTIONS_FILTER_VALUE}
            onChange={handleSectionFilterChange}
            options={[
              { label: t('allSections'), value: ALL_SECTIONS_FILTER_VALUE },
              ...projectSections.map((section) => ({ label: section.name, value: section.id })),
            ]}
            style={{ minWidth: 180 }}
          />
        </div>
      </div>

      <div className="task-list-surface">
        <Spin spinning={loading}>
          {loading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : tabFilteredTasks.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('noTasksTitle')} />
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
                  total={tabFilteredTasks.length}
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
