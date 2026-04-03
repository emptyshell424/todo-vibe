'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  App,
  Button,
  Checkbox,
  Empty,
  Input,
  type InputRef,
  Progress,
  Skeleton,
  Spin,
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
  ThunderboltOutlined,
} from '@ant-design/icons';
import { SignInButton, useUser } from '@clerk/nextjs';
import { supabase } from '@/lib/supabaseClient';

const { Text, Title } = Typography;
const AI_BREAKDOWN_PREFIX = '[[AI_BREAKDOWN]]';

interface Todo {
  id: string;
  text: string;
  is_completed: boolean;
  priority: string;
  user_id: string;
  created_at: string;
}

type AiBreakdownTask = {
  title: string;
  priority: 'high' | 'medium' | 'low';
};

type ParsedTodo = Todo & {
  displayText: string;
  groupTitle: string | null;
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

function encodeAiBreakdownText(goal: string, title: string) {
  return `${AI_BREAKDOWN_PREFIX}${JSON.stringify({
    goal: goal.trim(),
    title: title.trim(),
  })}`;
}

function parseTodo(todo: Todo): ParsedTodo {
  if (!todo.text.startsWith(AI_BREAKDOWN_PREFIX)) {
    return {
      ...todo,
      displayText: todo.text,
      groupTitle: null,
    };
  }

  const payload = todo.text.slice(AI_BREAKDOWN_PREFIX.length);

  try {
    const parsed = JSON.parse(payload) as { goal?: unknown; title?: unknown };
    const goal = typeof parsed.goal === 'string' ? parsed.goal.trim() : '';
    const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';

    if (!goal || !title) {
      throw new Error('Invalid AI breakdown payload');
    }

    return {
      ...todo,
      displayText: title,
      groupTitle: goal,
    };
  } catch {
    return {
      ...todo,
      displayText: todo.text,
      groupTitle: null,
    };
  }
}

function formatTimeLabel(todo: Todo, index: number) {
  const createdAt = new Date(todo.created_at);
  if (!Number.isNaN(createdAt.getTime())) {
    return createdAt.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const fallbackHour = 9 + (index % 7);
  return `${String(fallbackHour).padStart(2, '0')}:00`;
}

export default function Home() {
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

  const inputRef = useRef<InputRef>(null);

  const filteredTodos = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return todos.filter((todo) => !todo.is_completed);
      case 'completed':
        return todos.filter((todo) => todo.is_completed);
      default:
        return todos;
    }
  }, [todos, activeTab]);

  const todoListEntries = useMemo<TodoListEntry[]>(() => {
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

  const completedCount = useMemo(
    () => todos.filter((todo) => todo.is_completed).length,
    [todos]
  );
  const totalCount = todos.length;
  const activeCount = totalCount - completedCount;
  const focusScore = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  const streakDays = Math.max(3, Math.min(21, activeCount + 5));
  const groupedEntries = todoListEntries.filter((entry) => entry.type === 'group');
  const tomorrowPreview = todoListEntries.slice(0, 2);

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
          message: '加载任务失败',
          description: error.message,
          placement: 'topRight',
        });
      } else {
        setTodos(data || []);
      }

      setLoading(false);
    };

    fetchTodos();
  }, [isSignedIn, notification, user]);

  const handleAdd = async () => {
    const text = inputValue.trim();

    if (!text) {
      message.warning('先写下一件要完成的事');
      return;
    }
    if (!user) return;

    setAdding(true);
    const newTodo = {
      text,
      is_completed: false,
      priority: 'normal',
      user_id: user.id,
    };

    const { data, error } = await supabase.from('todos').insert(newTodo).select().single();

    if (error) {
      notification.error({
        message: '添加任务失败',
        description: error.message,
        placement: 'topRight',
      });
    } else {
      setTodos((prev) => [data, ...prev]);
      setInputValue('');
      message.success('任务已加入清单');
      inputRef.current?.focus();
    }

    setAdding(false);
  };

  const handleAiBreakdown = async () => {
    if (breakingDown) return;

    const goal = inputValue.trim();
    if (!goal) {
      message.warning('先输入一个较大的目标，例如：准备雅思考试');
      return;
    }
    if (!user) return;

    setBreakingDown(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const resp = await fetch('/api/ai/breakdown', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error || 'AI 服务响应异常');
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
      message.success('AI 已帮你拆解成可执行任务');
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        notification.warning({
          message: '请求超时',
          description: '网络有点忙，请稍后再试',
          placement: 'topRight',
        });
      } else {
        notification.error({
          message: 'AI 拆解失败',
          description: error instanceof Error ? error.message : 'AI 拆解服务暂时不可用',
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
        message: '更新状态失败',
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

  const handleDelete = (id: string) => {
    modal.confirm({
      title: '确定删除这个任务吗？',
      icon: <ExclamationCircleOutlined />,
      content: '删除后无法恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        if (!user) return;
        setDeletingIds((prev) => new Set(prev).add(id));

        const { error } = await supabase.from('todos').delete().eq('id', id).eq('user_id', user.id);

        if (error) {
          notification.error({
            message: '删除任务失败',
            description: error.message,
            placement: 'topRight',
          });
        } else {
          setTodos((prev) => prev.filter((todo) => todo.id !== id));
          message.success('任务已删除');
        }

        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      },
    });
  };

  const renderTodoRow = (item: ParsedTodo, index: number, compact = false) => (
    <article key={item.id} className={`task-row${item.is_completed ? ' is-complete' : ''}`}>
      <div className="task-row-main">
        <Checkbox
          checked={item.is_completed}
          onChange={() => toggleComplete(item.id)}
          disabled={togglingIds.has(item.id)}
        />
        <div className="task-row-copy">
          <h4>{item.displayText}</h4>
          <div className="task-row-meta">
            <span>
              <ClockCircleOutlined />
              {formatTimeLabel(item, index)}
            </span>
            {item.groupTitle ? (
              <span>
                <RobotOutlined />
                AI breakdown
              </span>
            ) : (
              <span>
                <CalendarOutlined />
                Today
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="task-row-actions">
        <Tag color={item.priority === 'urgent' ? 'error' : 'processing'} bordered={false}>
          {item.priority === 'urgent' ? 'High focus' : 'Steady pace'}
        </Tag>
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          loading={deletingIds.has(item.id)}
          disabled={deletingIds.has(item.id)}
          onClick={() => handleDelete(item.id)}
        />
      </div>
    </article>
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
        <div className="signed-out-hero">
          <div className="signed-out-copy">
            <span className="eyebrow">A calm planning ritual</span>
            <Title>让待办列表从“堆任务”变成“会呼吸的工作台”</Title>
            <Text>
              登录后你可以记录日常任务，也可以把一个大目标交给 AI，自动拆成清晰可执行的小步骤。
            </Text>
            <div className="signed-out-actions">
              <SignInButton mode="modal">
                <Button type="primary" size="large">
                  立即登录
                </Button>
              </SignInButton>
              <Button size="large" icon={<RobotOutlined />} disabled>
                AI 拆解示例
              </Button>
            </div>
          </div>

          <div className="signed-out-preview">
            <div className="preview-orb" />
            <div className="preview-card">
              <span className="eyebrow">Focus workflow</span>
              <h3>从一个目标开始</h3>
              <p>例如“准备雅思考试”或“上线新版本”，系统会帮你沉淀成今天就能推进的下一步。</p>
              <div className="preview-list">
                <div>
                  <CheckCircleOutlined />
                  <span>保存任务并同步到你的账户</span>
                </div>
                <div>
                  <RobotOutlined />
                  <span>一键拆解大任务，自动生成子任务组</span>
                </div>
                <div>
                  <ThunderboltOutlined />
                  <span>在同一个页面里处理今天、进行中和已完成</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-home">
      <section className="hero-strip">
        <div>
          <span className="eyebrow">Today dashboard</span>
          <h2>
            早上好，{user?.firstName || user?.username || '朋友'}
            <span> 先把注意力留给最重要的事。</span>
          </h2>
          <p>
            你当前有 {activeCount} 个进行中任务，已完成 {completedCount} 个。输入一件下一步要做的事，或者输入一个大目标交给
            AI 拆解。
          </p>
        </div>

        <div className="hero-stats">
          <div className="hero-stat-card">
            <strong>{focusScore}%</strong>
            <span>Focus score</span>
          </div>
          <div className="hero-stat-card soft">
            <strong>{streakDays} days</strong>
            <span>Steady streak</span>
          </div>
        </div>
      </section>

      <section className="composer-panel">
        <div className="composer-icon">
          <RobotOutlined />
        </div>
        <Input
          ref={inputRef}
          className="composer-input"
          variant="borderless"
          placeholder="写下下一件事，或输入一个大目标让 AI 帮你拆解"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPressEnter={handleAdd}
          disabled={adding || breakingDown}
        />
        <div className="composer-actions">
          <Button
            size="large"
            icon={<RobotOutlined />}
            onClick={handleAiBreakdown}
            loading={breakingDown}
            disabled={adding || breakingDown}
          >
            AI 拆解
          </Button>
          <Button
            type="primary"
            size="large"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            loading={adding}
            disabled={breakingDown}
          >
            添加任务
          </Button>
        </div>
      </section>

      <div className="workspace-grid">
        <section className="tasks-column">
          <div className="section-heading">
            <div>
              <h3>Today</h3>
              <p>按节奏推进今天的任务，完成的事项会沉到下方。</p>
            </div>
            <div className="filter-pills">
              {[
                { key: 'all', label: `全部 ${totalCount}` },
                { key: 'active', label: `进行中 ${activeCount}` },
                { key: 'completed', label: `已完成 ${completedCount}` },
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
          </div>

          <div className="task-list-surface">
            <Spin spinning={loading}>
              {loading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
              ) : filteredTodos.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    activeTab === 'all'
                      ? '还没有任务，先写下今天最重要的一件事。'
                      : activeTab === 'active'
                        ? '当前没有进行中的任务。'
                        : '还没有已完成的任务，开始推进吧。'
                  }
                >
                  {activeTab === 'all' && (
                    <Button type="primary" onClick={() => inputRef.current?.focus()}>
                      开始添加
                    </Button>
                  )}
                </Empty>
              ) : (
                <div className="task-list-stack">
                  {todoListEntries.map((entry, index) => {
                    if (entry.type === 'single') {
                      return renderTodoRow(entry.todo, index);
                    }

                    return (
                      <section key={entry.key} className="task-group">
                        <div className="task-group-head">
                          <div>
                            <span className="eyebrow">AI breakdown</span>
                            <h4>{entry.title}</h4>
                          </div>
                          <Tag color="processing" bordered={false}>
                            {entry.todos.length} 个子任务
                          </Tag>
                        </div>
                        <div className="task-group-list">
                          {entry.todos.map((todo, todoIndex) =>
                            renderTodoRow(todo, todoIndex, true)
                          )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              )}
            </Spin>
          </div>
        </section>

        <aside className="insight-column">
          <section className="insight-card">
            <div className="section-heading compact">
              <div>
                <h3>Overview</h3>
                <p>用最少的信息，快速看清今天的推进状态。</p>
              </div>
            </div>

            <div className="metric-stack">
              <div className="metric-row">
                <span>Daily completion</span>
                <strong>{focusScore}%</strong>
              </div>
              <Progress percent={focusScore} showInfo={false} strokeColor="#006592" trailColor="#dde3eb" />
              <div className="metric-grid">
                <div>
                  <strong>{totalCount}</strong>
                  <span>All tasks</span>
                </div>
                <div>
                  <strong>{activeCount}</strong>
                  <span>In progress</span>
                </div>
                <div>
                  <strong>{completedCount}</strong>
                  <span>Completed</span>
                </div>
                <div>
                  <strong>{groupedEntries.length}</strong>
                  <span>AI groups</span>
                </div>
              </div>
            </div>
          </section>

          <section className="insight-card muted">
            <div className="section-heading compact">
              <div>
                <h3>Next horizon</h3>
                <p>从当前清单中挑两项，假设为你接下来要衔接的任务。</p>
              </div>
            </div>
            <div className="tomorrow-list">
              {tomorrowPreview.length === 0 ? (
                <p className="placeholder-copy">今天先创建几个任务，这里会自动出现下一步预览。</p>
              ) : (
                tomorrowPreview.map((entry, index) => {
                  const todo = entry.type === 'single' ? entry.todo : entry.todos[0];
                  return (
                    <div key={todo.id} className="tomorrow-item">
                      <span className="tomorrow-dot" />
                      <div>
                        <p>{todo.displayText}</p>
                        <span>{index === 0 ? '优先处理' : '后续衔接'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="wisdom-card">
            <div className="wisdom-overlay" />
            <div className="wisdom-content">
              <FireOutlined />
              <p>“真正的效率，不是把一切塞满，而是让重要的事情拥有足够安静的空间。”</p>
              <span>Todo Vibe ritual</span>
            </div>
          </section>

          <section className="mini-stats">
            <div className="mini-stat-card">
              <CheckCircleOutlined />
              <strong>{completedCount}</strong>
              <span>Done today</span>
            </div>
            <div className="mini-stat-card">
              <ClockCircleOutlined />
              <strong>{Math.max(1, Math.ceil(activeCount * 0.8))}h</strong>
              <span>Focus estimate</span>
            </div>
          </section>
        </aside>
      </div>

      <section className="mobile-cta">
        <Button type="primary" size="large" icon={<ArrowRightOutlined />} onClick={() => inputRef.current?.focus()}>
          添加下一件事
        </Button>
      </section>
    </section>
  );
}
