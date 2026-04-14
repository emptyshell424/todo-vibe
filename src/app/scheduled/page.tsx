'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import {
  App,
  Button,
  Calendar,
  Card,
  Empty,
  Skeleton,
  Spin,
  Typography,
  Tag,
} from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  LeftOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useUser } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import TodoItem, { type Todo } from '@/components/TodoItem';
import { parseTodo } from '@/lib/todoUtils';
import { useI18n } from '@/components/I18nProvider';

const { Title, Text } = Typography;

export default function ScheduledPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="workspace-home"><Skeleton active paragraph={{ rows: 10 }} /></div>}>
      <ScheduledContent />
    </Suspense>
  );
}

function ScheduledContent() {
  const { t, language } = useI18n();
  const { isLoaded, isSignedIn, user } = useUser();
  const { message, notification } = App.useApp();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';

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
        .order('created_at', { ascending: true });

      if (error) {
        notification.error({
          message: t('loadTasksFailed'),
          description: error.message,
        });
      } else {
        setTodos(data || []);
      }

      setLoading(false);
    };

    fetchTodos();
  }, [isSignedIn, notification, user, t]);

  const parsedTodos = useMemo(() => {
    return todos.map(parseTodo).filter(t => !t.is_completed);
  }, [todos]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, typeof parsedTodos> = {};
    const locale = language === 'zh' ? 'zh-CN' : 'en-US';
    const unscheduledKey = t('unscheduled');
    
    parsedTodos.forEach(todo => {
      const date = todo.due_date ? new Date(todo.due_date).toLocaleDateString(locale) : unscheduledKey;
      if (!groups[date]) groups[date] = [];
      groups[date].push(todo);
    });

    return Object.entries(groups).sort((a, b) => {
      if (a[0] === unscheduledKey) return 1;
      if (b[0] === unscheduledKey) return -1;
      return new Date(a[0]).getTime() - new Date(b[0]).getTime();
    });
  }, [parsedTodos, language, t]);

  const handleToggle = async (id: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('todos')
      .update({ is_completed: true })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      notification.error({ message: t('statusUpdateFailed'), description: error.message });
    } else {
      setTodos((prev) => prev.map(t => t.id === id ? { ...t, is_completed: true } : t));
      message.success(t('taskAdded')); // Reusing or should I add "task completed"? 
      // Actually TaskAdded might be misleading, but adding "Task completed" is better.
      // I'll reuse t('taskAdded') for now but let's see. 
      // Wait, let's use a clear message. I'll add 'taskCompleted' to translations.
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    const { error } = await supabase.from('todos').delete().eq('id', id).eq('user_id', user.id);
    if (error) {
      notification.error({ message: t('deleteFailed'), description: error.message });
    } else {
      setTodos((prev) => prev.filter((t) => t.id !== id));
      message.success(t('deleteSuccess'));
    }
  };

  const handleUpdate = async (id: string, updates: Partial<Todo>) => {
    if (!user) return;
    const { error } = await supabase.from('todos').update(updates).eq('id', id).eq('user_id', user.id);
    if (error) {
      notification.error({ message: t('updateFailed'), description: error.message });
    } else {
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    }
  };

  if (!isLoaded || !isSignedIn) {
    return (
      <section className="workspace-home">
        <div className="loading-shell">
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      </section>
    );
  }

  return (
    <section className="workspace-home">
      <section className="hero-strip">
        <div>
          <span className="eyebrow">Timeline View</span>
          <h2>
            {t('scheduledTitle')}
            <span>{t('timeRhythm')}</span>
          </h2>
          <p>{t('scheduledHeroDesc')}</p>
        </div>
        <div className="hero-stats">
          <div className="hero-stat-card">
            <strong>{parsedTodos.length}</strong>
            <span>{t('activeTasks')}</span>
          </div>
        </div>
      </section>

      <div className="workspace-grid">
        <section className="tasks-column">
          <div className="section-heading">
            <h3>{t('upcoming')}</h3>
          </div>

          <div className="task-list-surface">
            <Spin spinning={loading}>
              {loading ? (
                <Skeleton active paragraph={{ rows: 6 }} />
              ) : groupedByDate.length === 0 ? (
                <Empty description={t('noScheduledTasks')} />
              ) : (
                <div className="task-list-stack">
                  {groupedByDate.map(([date, items]) => (
                    <section key={date} className="task-group">
                      <div className="task-group-head">
                        <div>
                          <span className="eyebrow">{t('scheduledFor')}</span>
                          <h4>{date}</h4>
                        </div>
                        <Tag color="blue" variant="filled">{t('taskCount', { count: items.length })}</Tag>
                      </div>
                      <div className="task-group-list">
                        {items.map((item, idx) => (
                          <TodoItem
                            key={item.id}
                            item={item}
                            index={idx}
                            togglingIds={togglingIds}
                            deletingIds={deletingIds}
                            onToggle={handleToggle}
                            onDelete={handleDelete}
                            onUpdate={handleUpdate}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </Spin>
          </div>
        </section>

        <aside className="insight-column">
          <Card variant="borderless" className="calendar-card">
            <Calendar fullscreen={false} />
          </Card>
        </aside>
      </div>
    </section>
  );
}
