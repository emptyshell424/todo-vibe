'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import {
  App,
  Button,
  Empty,
  Skeleton,
  Spin,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useUser } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import TodoItem, { type ParsedTodo, type Todo } from '@/components/TodoItem';
import { parseTodo } from '@/lib/todoUtils';
import { useI18n } from '@/components/I18nProvider';

const { Title, Text } = Typography;

export default function CompletedPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="workspace-home"><Skeleton active paragraph={{ rows: 10 }} /></div>}>
      <CompletedContent />
    </Suspense>
  );
}

function CompletedContent() {
  const { t } = useI18n();
  const { isLoaded, isSignedIn, user } = useUser();
  const { message, notification, modal } = App.useApp();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') || '';

  useEffect(() => {
    const fetchCompletedTodos = async () => {
      if (!isSignedIn || !user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_completed', true)
        .order('created_at', { ascending: false });

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

    fetchCompletedTodos();
  }, [isSignedIn, notification, user, t]);

  const filteredTodos = useMemo(() => {
    let result = todos;
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
  }, [todos, searchQuery]);

  const handleToggle = async (id: string) => {
    if (!user) return;
    const target = todos.find((t) => t.id === id);
    if (!target) return;

    setTogglingIds((prev) => new Set(prev).add(id));
    const newStatus = !target.is_completed;

    const { error } = await supabase
      .from('todos')
      .update({ is_completed: newStatus })
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      notification.error({ message: t('statusUpdateFailed'), description: error.message });
    } else {
      // Since this is the completed page, unmarking means it disappears
      setTodos((prev) => prev.filter((t) => t.id !== id));
      message.success(t('movedBackToList'));
    }
    setTogglingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleDelete = (id: string) => {
    modal.confirm({
      title: t('permanentDeleteTitle'),
      content: t('deleteTaskDesc'),
      okText: t('deleteOk'),
      okType: 'danger',
      async onOk() {
        if (!user) return;
        setDeletingIds((prev) => new Set(prev).add(id));
        const { error } = await supabase.from('todos').delete().eq('id', id).eq('user_id', user.id);
        if (error) {
          notification.error({ message: t('deleteFailed'), description: error.message });
        } else {
          setTodos((prev) => prev.filter((t) => t.id !== id));
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

  const handleUpdate = async (id: string, updates: Partial<Todo>) => {
    if (!user) return;
    const { error } = await supabase.from('todos').update(updates).eq('id', id).eq('user_id', user.id);
    if (error) {
      notification.error({ message: t('updateFailed'), description: error.message });
    } else {
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    }
  };

  const handleClearAll = () => {
    if (todos.length === 0) return;
    modal.confirm({
      title: t('clearAllCompletedTitle'),
      content: t('clearAllCompletedConfirm', { count: todos.length }),
      okText: t('clearCompletedOk'),
      okType: 'danger',
      async onOk() {
        const { error } = await supabase
          .from('todos')
          .delete()
          .eq('is_completed', true)
          .eq('user_id', user?.id);

        if (error) {
          notification.error({ message: t('operationFailed'), description: error.message });
        } else {
          setTodos([]);
          message.success(t('clearCompletedSuccess'));
        }
      },
    });
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
          <span className="eyebrow">Archive View</span>
          <h2>
            {t('completedTasks')}
            <span>{t('achievementList')}</span>
          </h2>
          <p>{t('archiveHeroDesc')}</p>
        </div>
        <div className="hero-stats">
          <div className="hero-stat-card">
            <strong>{todos.length}</strong>
            <span>{t('tasksCompleted')}</span>
          </div>
        </div>
      </section>

      <div className="section-heading">
        <div>
          <h3>{t('history')}</h3>
          <p>{searchQuery ? t('searchResultsFor', { query: searchQuery }) : t('allHistoryDesc')}</p>
        </div>
        {todos.length > 0 && (
          <Button danger icon={<DeleteOutlined />} onClick={handleClearAll}>
            {t('clearAllRecords')}
          </Button>
        )}
      </div>

      <div className="task-list-surface">
        <Spin spinning={loading}>
          {loading ? (
            <Skeleton active paragraph={{ rows: 6 }} />
          ) : filteredTodos.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={searchQuery ? t('noTasksTitle') : t('noCompletedFound')}
            />
          ) : (
            <div className="task-list-stack">
              {filteredTodos.map((todo, index) => (
                <TodoItem
                  key={todo.id}
                  item={parseTodo(todo)}
                  index={index}
                  togglingIds={togglingIds}
                  deletingIds={deletingIds}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onUpdate={handleUpdate}
                />
              ))}
            </div>
          )}
        </Spin>
      </div>
    </section>
  );
}
