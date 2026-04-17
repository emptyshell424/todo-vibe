'use client';

import React, { useEffect, useMemo, useRef, useState, Suspense } from 'react';
import {
  App,
  Button,
  Checkbox,
  Empty,
  Input,
  type InputRef,
  Pagination,
  Progress,
  Segmented,
  Skeleton,
  Spin,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  ArrowRightOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  FireOutlined,
  PlusOutlined,
  RobotOutlined,
  SearchOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { DatePicker } from 'antd';
import { SignInButton, useUser } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import TodoItem, { type ParsedTodo, type Todo } from '@/components/TodoItem';
import { useI18n } from '@/components/I18nProvider';
import { motion, AnimatePresence } from 'framer-motion';
import SignInPrompt from '@/components/SignInPrompt';

const { Text, Title } = Typography;
import { AI_BREAKDOWN_PREFIX, parseTodo, encodeAiBreakdownText, encodeNormalTodoText } from '@/lib/todoUtils';

type AiBreakdownTask = {
  title: string;
  priority: 'high' | 'medium' | 'low';
};

type TodoListEntry =
  | { type: 'single'; todo: ParsedTodo }
  | { type: 'group'; key: string; title: string; todos: ParsedTodo[] };

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

export default function Home() {
  return (
    <Suspense fallback={<div className="workspace-home"><Skeleton active paragraph={{ rows: 10 }} /></div>}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const { t, language } = useI18n();
  const { isLoaded, isSignedIn, user } = useUser();
  const { message, notification, modal } = App.useApp();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'completed'>('all');
  const [breakingDown, setBreakingDown] = useState(false);
  const searchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [newPriority, setNewPriority] = useState<'normal' | 'urgent'>('normal');
  const [scheduledDate, setScheduledDate] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
    setCurrentPage(1);
  }, [searchParams]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab]);

  useEffect(() => {
    if (searchParams.get('focus') === 'true') {
      inputRef.current?.focus();
    }
  }, [searchParams]);

  const inputRef = useRef<InputRef>(null);

  const filteredTodos = useMemo(() => {
    let result = todos;

    // Filter by Today (Today means no due date, or due date is today)
    const locale = language === 'zh' ? 'zh-CN' : 'en-US';
    const todayStr = new Date().toLocaleDateString(locale);
    
    result = result.filter(todo => {
      const parsed = parseTodo(todo);
      const isToday = !parsed.due_date || new Date(parsed.due_date).toLocaleDateString(locale) === todayStr;
      return isToday;
    });

    // Filter by tab
    switch (activeTab) {
      case 'active':
        result = result.filter((todo) => !todo.is_completed);
        break;
      case 'completed':
        result = result.filter((todo) => todo.is_completed);
        break;
    }

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((todo) => {
        const parsed = parseTodo(todo);
        return (
          parsed.displayText.toLowerCase().includes(q) ||
          (parsed.groupTitle && parsed.groupTitle.toLowerCase().includes(q))
        );
      });
    }

    return result;
  }, [todos, activeTab, searchQuery, language]);

  const allTodoListEntries = useMemo<TodoListEntry[]>(() => {
    const parsedTodos = filteredTodos.map(parseTodo);
    const entries: TodoListEntry[] = [];

    for (const todo of parsedTodos) {
      if (!todo.groupTitle) {
        entries.push({ type: 'single', todo });
        continue;
      }

      const lastEntry = entries[entries.length - 1];
      if (lastEntry && lastEntry.type === 'group' && lastEntry.title === todo.groupTitle) {
        lastEntry.todos.push(todo);
        continue;
      }

      entries.push({
        type: 'group',
        key: `${todo.groupTitle}-${todo.id}`,
        title: todo.groupTitle,
        todos: [todo],
      });
    }

    return entries;
  }, [filteredTodos]);

  const todoListEntries = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return allTodoListEntries.slice(start, start + pageSize);
  }, [allTodoListEntries, currentPage]);

  const completedCount = useMemo(
    () => todos.filter((todo) => todo.is_completed).length,
    [todos]
  );
  const totalCount = todos.length;
  const activeCount = totalCount - completedCount;
  const focusScore = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const groupedEntries = allTodoListEntries.filter((entry) => entry.type === 'group');
  const streakDays = Math.max(1, Math.floor(completedCount / 2) + 1);
  
  const tomorrowPreview = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    return todos
      .map(parseTodo)
      .filter(t => t.due_date && new Date(t.due_date) > today && !t.is_completed)
      .slice(0, 3);
  }, [todos]);

  useEffect(() => {
    const fetchTodos = async () => {
      if (!isSignedIn || !user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        notification.error({
          title: t('loadTasksFailed'),
          description: error.message,
          placement: 'topRight',
        });
      } else {
        setTodos(data || []);
      }

      setLoading(false);
    };

    fetchTodos();
  }, [isSignedIn, notification, user, t]);

  const handleAdd = async () => {
    const text = inputValue.trim();

    if (!text) {
      message.warning(t('writeSomethingFirst'));
      return;
    }
    if (!user) return;

    setAdding(true);
    const newTodo = {
      text: encodeNormalTodoText(text, scheduledDate || undefined),
      is_completed: false,
      priority: newPriority,
      user_id: user.id,
    };

    const { data, error } = await supabase.from('todos').insert(newTodo).select().single();

    if (error) {
      notification.error({
        title: t('addFailed'),
        description: error.message,
        placement: 'topRight',
      });
    } else {
      setTodos((prev) => [data, ...prev]);
      setInputValue('');
      setNewPriority('normal');
      setCurrentPage(1);
      message.success(t('taskAdded'));
      inputRef.current?.focus();
    }

    setAdding(false);
  };

  const handleAiBreakdown = async () => {
    if (breakingDown) return;

    const goal = inputValue.trim();
    if (!goal) {
      message.warning(t('aiGoalPrompt'));
      return;
    }
    if (!user) return;

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

      const resp = await fetch('/api/ai/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, apiKey, provider, baseUrl, model }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || t('aiFailed'));
      }

      const tasks: unknown = await resp.json();
      if (!isValidAiBreakdownTasks(tasks)) {
        throw new Error('AI 返回的数据格式不正确，请稍后重试');
      }

      const newTodos = tasks.map((task) => ({
        text: encodeAiBreakdownText(goal, task.title),
        priority: task.priority === 'high' ? 'urgent' : 'normal',
        is_completed: false,
        user_id: user.id,
      }));

      const { data, error } = await supabase.from('todos').insert(newTodos).select();

      if (error) {
        throw error;
      }

      setTodos((prev) => [...(data || []), ...prev]);
      setInputValue('');
      setNewPriority('normal');
      setCurrentPage(1);
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
    if (!user) return;
    const target = todos.find((todo) => todo.id === id);
    if (!target) return;

    setTogglingIds((prev) => new Set(prev).add(id));
    const newStatus = !target.is_completed;

    const { error } = await supabase
      .from('todos')
      .update({ is_completed: newStatus })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      notification.error({
        title: t('statusUpdateFailed'),
        description: error.message,
        placement: 'topRight',
      });
    } else {
      setTodos((prev) =>
        prev.map((todo) => (todo.id === id ? { ...todo, is_completed: newStatus } : todo))
      );
    }

    setTogglingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleUpdate = async (id: string, updates: Partial<Todo>) => {
    if (!user) return;

    const { error } = await supabase.from('todos').update(updates).eq('id', id).eq('user_id', user.id);

    if (error) {
      notification.error({
        title: t('updateFailed'),
        description: error.message,
        placement: 'topRight',
      });
    } else {
      setTodos((prev) => prev.map((todo) => (todo.id === id ? { ...todo, ...updates } : todo)));
    }
  };

  const handleClearCompleted = () => {
    const completedIds = todos.filter((t) => t.is_completed).map((t) => t.id);
    if (completedIds.length === 0) return;

    modal.confirm({
      title: t('clearCompletedTitle'),
      content: t('clearCompletedConfirm', { count: completedIds.length }),
      okText: t('clearCompletedOk'),
      okType: 'danger',
      onOk: async () => {
        const { error } = await supabase
          .from('todos')
          .delete()
          .in('id', completedIds)
          .eq('user_id', user?.id);

        if (error) {
          notification.error({ title: t('clearCompleted'), description: error.message });
        } else {
          setTodos((prev) => prev.filter((t) => !t.is_completed));
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
      async onOk() {
        if (!user) return;
        setDeletingIds((prev) => new Set(prev).add(id));

        const { error } = await supabase.from('todos').delete().eq('id', id).eq('user_id', user.id);

        if (error) {
          notification.error({
            title: t('deleteFailed'),
            description: error.message,
            placement: 'topRight',
          });
        } else {
          setTodos((prev) => prev.filter((todo) => todo.id !== id));
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

  const renderTodoRow = (item: ParsedTodo, index: number) => (
    <TodoItem
      key={item.id}
      item={item}
      index={index}
      togglingIds={togglingIds}
      deletingIds={deletingIds}
      onToggle={toggleComplete}
      onDelete={handleDelete}
      onUpdate={handleUpdate}
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
            {t('goodMorning')}{user?.firstName || user?.username || t('friend')}
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
          delay: 0.2
        }}
        whileHover={{ scale: 1.005 }}
      >
        <AnimatePresence>
          {breakingDown && (
            <motion.div 
              className="ai-progress-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="ai-progress-shimmer" />
              <div className="ai-progress-pulse" />
              <span className="ai-progress-label">{t('aiThinking')}</span>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="composer-icon">
          <ThunderboltOutlined />
        </div>
        <Input
          ref={inputRef}
          className="composer-input"
          variant="borderless"
          placeholder={t('composerPlaceholder')}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPressEnter={handleAdd}
          disabled={adding || breakingDown}
        />
        <div className="composer-actions">
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
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
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
                ) : filteredTodos.length === 0 ? (
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
                    {todoListEntries.map((entry, index) => {
                      if (entry.type === 'single') {
                        return renderTodoRow(entry.todo, index);
                      }

                      return (
                        <motion.section 
                          layout
                          key={entry.key} 
                          className="task-group"
                        >
                          <div className="task-group-head">
                            <div>
                              <span className="eyebrow secondary-label">{t('aiBreakdownTag')}</span>
                              <h4 className="editorial-header" style={{ fontSize: '1.4rem' }}>{entry.title}</h4>
                            </div>
                          </div>
                          <div className="task-group-list">
                            {entry.todos.map((todo, todoIndex) =>
                              renderTodoRow(todo, todoIndex)
                            )}
                          </div>
                        </motion.section>
                      );
                    })}
                    <div className="pagination-wrapper">
                      <Pagination
                        current={currentPage}
                        pageSize={pageSize}
                        total={allTodoListEntries.length}
                        onChange={(page) => setCurrentPage(page)}
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
                  )
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
                          tomorrowPreview.map((todo, index) => {
                            return (
                              <div key={todo.id} className="tomorrow-item">
                                <span className="tomorrow-dot" />
                                <div>
                                  <p>{todo.displayText}</p>
                                  <span>{index === 0 ? (language === 'zh' ? '优先处理' : 'Top priority') : (language === 'zh' ? '后续衔接' : 'Next bridge')}</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )
                },
                {
                  key: '3',
                  label: 'Ritual',
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
                          <ClockCircleOutlined />
                          <strong>{Math.max(1, Math.ceil(activeCount * 0.8))}h</strong>
                        </div>
                      </div>
                    </div>
                  )
                }
              ]}
            />
          </section>
        </aside>
      </div>
    </section>
  );
}
