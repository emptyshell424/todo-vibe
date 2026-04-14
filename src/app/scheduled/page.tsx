'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import {
  App,
  Button,
  Empty,
  Pagination,
  Skeleton,
  Spin,
  Typography,
} from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useUser } from '@clerk/nextjs';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import TodoItem, { type ParsedTodo, type Todo } from '@/components/TodoItem';
import { parseTodo } from '@/lib/todoUtils';
import { useI18n } from '@/components/I18nProvider';
import { motion } from 'framer-motion';

const { Title, Text } = Typography;

export default function ScheduledPage() {
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
  const router = useRouter();

  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;
  
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
        .order('created_at', { ascending: false });

      if (error) {
        notification.error({
          title: t('loadTasksFailed'),
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
    return todos.map(parseTodo).filter(todo => {
      // Filter for tasks that have a due date
      if (!todo.due_date) return false;
      
      // If there's a search query, filter by it too
      if (searchQuery.trim()) {
         const q = searchQuery.toLowerCase();
         return (
            todo.displayText.toLowerCase().includes(q) ||
            (todo.groupTitle && todo.groupTitle.toLowerCase().includes(q))
         );
      }
      return true;
    });
  }, [todos, searchQuery]);

  // Group by date
  const groupedTodos = useMemo(() => {
    const groups: { [date: string]: ParsedTodo[] } = {};
    parsedTodos.forEach(todo => {
      const dateKey = new Date(todo.due_date!).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(todo);
    });
    
    // Sort groups by date
    return Object.entries(groups).sort((a, b) => {
      return new Date(a[0]).getTime() - new Date(b[0]).getTime();
    });
  }, [parsedTodos, language]);

  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return groupedTodos.slice(start, start + pageSize);
  }, [groupedTodos, currentPage]);

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
      notification.error({ title: t('statusUpdateFailed'), description: error.message });
    } else {
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, is_completed: newStatus } : t)));
    }
    setTogglingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    setDeletingIds((prev) => new Set(prev).add(id));
    const { error } = await supabase.from('todos').delete().eq('id', id).eq('user_id', user.id);
    if (error) {
      notification.error({ title: t('deleteFailed'), description: error.message });
    } else {
      setTodos((prev) => prev.filter((t) => t.id !== id));
      message.success(t('deleteSuccess'));
    }
    setDeletingIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const handleUpdate = async (id: string, updates: Partial<Todo>) => {
    if (!user) return;
    const { error } = await supabase.from('todos').update(updates).eq('id', id).eq('user_id', user.id);
    if (error) {
      notification.error({ title: t('updateFailed'), description: error.message });
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
        <motion.div
           initial={{ opacity: 0, x: -20 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ duration: 0.6 }}
        >
          <span className="eyebrow secondary-label">{t('scheduledTitle')}</span>
          <h2 className="editorial-header">
            {t('timeRhythm')}
          </h2>
          <p>{t('scheduledHeroDesc')}</p>
        </motion.div>
        <div className="hero-stats">
          <div className="hero-stat-card bento-small">
            <strong className="editorial-header">{parsedTodos.length}</strong>
            <span className="secondary-label">{t('pending')}</span>
          </div>
        </div>
      </section>

      <div className="section-heading">
        <div>
          <h3 className="editorial-header">{t('upcoming')}</h3>
          <p>{searchQuery ? t('searchResultsFor', { query: searchQuery }) : t('allTasks')}</p>
        </div>
      </div>

      <div className="task-list-surface">
        <Spin spinning={loading}>
          {loading ? (
             <Skeleton active paragraph={{ rows: 6 }} />
          ) : groupedTodos.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t('noScheduledTasks')}
            >
               <Button type="primary" onClick={() => router.push('/?focus=true')}>
                 {t('addTask')}
               </Button>
            </Empty>
          ) : (
            <div className="task-list-stack">
              {paginatedGroups.map(([date, items]) => (
                <div key={date} className="task-group">
                   <div className="task-group-head">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CalendarOutlined style={{ color: 'var(--text-muted)' }} />
                        <h4 className="editorial-header" style={{ fontSize: '1.2rem', margin: 0 }}>{date}</h4>
                      </div>
                      <span className="secondary-label">{t('taskCount', { count: items.length })}</span>
                   </div>
                   <div className="task-group-list">
                    {items.map((item, index) => (
                      <TodoItem
                        key={item.id}
                        item={item}
                        index={index}
                        togglingIds={togglingIds}
                        deletingIds={deletingIds}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                        onUpdate={handleUpdate}
                      />
                    ))}
                   </div>
                </div>
              ))}
              
              <div className="pagination-wrapper">
                <Pagination
                  current={currentPage}
                  pageSize={pageSize}
                  total={groupedTodos.length}
                  onChange={(page) => setCurrentPage(page)}
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
