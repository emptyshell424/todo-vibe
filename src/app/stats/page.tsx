'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { App, Card, Col, Progress, Row, Skeleton, Statistic, Tag } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  FireOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useAuth, useUser } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import { createClerkSupabaseClient } from '@/lib/supabaseClient';
import { useI18n } from '@/components/I18nProvider';
import SignInPrompt from '@/components/SignInPrompt';
import { TASK_SELECT, coerceTaskRows, filterTasksByScope, getVisibleTasks, hydrateTasks, type DisplayTask } from '@/lib/taskModel';

export default function StatsPage() {
  return (
    <Suspense fallback={<div className="workspace-home"><Skeleton active paragraph={{ rows: 10 }} /></div>}>
      <StatsContent />
    </Suspense>
  );
}

function StatsContent() {
  const { t } = useI18n();
  const { isLoaded, isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const supabase = useMemo(() => createClerkSupabaseClient(getToken), [getToken]);
  const { notification } = App.useApp();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q')?.trim() ?? '';

  const [tasks, setTasks] = useState<DisplayTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!isLoaded || !isSignedIn || !user) {
        setTasks([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase.from('tasks').select(TASK_SELECT).eq('user_id', user.id);

      if (error) {
        notification.error({
          title: t('loadStatsFailed'),
          description: error.message,
        });
      } else {
        setTasks(getVisibleTasks(hydrateTasks(coerceTaskRows(data))));
      }

      setLoading(false);
    };

    void fetchTasks();
  }, [isLoaded, isSignedIn, notification, supabase, t, user]);

  const filteredTasks = useMemo(
    () => filterTasksByScope(tasks, { searchQuery }),
    [searchQuery, tasks]
  );

  const stats = useMemo(() => {
    const total = filteredTasks.length;
    const completed = filteredTasks.filter((task) => task.is_completed).length;
    const active = total - completed;
    const rate = total === 0 ? 0 : Math.round((completed / total) * 100);
    const p1 = filteredTasks.filter((task) => task.priority === 4).length;
    const p2 = filteredTasks.filter((task) => task.priority === 3).length;
    const p3 = filteredTasks.filter((task) => task.priority === 2).length;
    const p4 = filteredTasks.filter((task) => task.priority === 1).length;
    const aiGroups = new Set(filteredTasks.filter((task) => task.parent_id).map((task) => task.parent_id)).size;

    return { total, completed, active, rate, p1, p2, p3, p4, aiGroups };
  }, [filteredTasks]);

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
          <span className="eyebrow">{t('insightsMetrics')}</span>
          <h2>
            {t('efficiencyInsights')}
            <span>{t('growthTrajectory')}</span>
          </h2>
          <p>{t('statsHeroDesc')}</p>
        </div>
        <div className="hero-stats">
          <div className="hero-stat-card">
            <strong>{stats.rate}%</strong>
            <span>{t('totalSuccess')}</span>
          </div>
        </div>
      </section>

      <div className="stats-dashboard">
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="borderless" className="metric-card shadow-sm">
              <Statistic title={t('totalTasks')} value={stats.total} prefix={<DashboardOutlined />} styles={{ content: { color: '#006592' } }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="borderless" className="metric-card shadow-sm">
              <Statistic title={t('completed')} value={stats.completed} prefix={<CheckCircleOutlined />} styles={{ content: { color: '#52c41a' } }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="borderless" className="metric-card shadow-sm">
              <Statistic title={t('pending')} value={stats.active} prefix={<ClockCircleOutlined />} styles={{ content: { color: '#1890ff' } }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="borderless" className="metric-card shadow-sm">
              <Statistic title={t('aiAssisted')} value={stats.aiGroups} prefix={<ThunderboltOutlined />} styles={{ content: { color: '#722ed1' } }} />
            </Card>
          </Col>
        </Row>

        <div className="stats-main-grid">
          <Row gutter={[24, 24]} className="mt-6">
            <Col xs={24} lg={16}>
              <Card title={t('completionEfficiency')} variant="borderless" className="shadow-sm">
                <div className="progress-section">
                  <div className="progress-label">
                    <span>{t('overallCompletionRate')}</span>
                    <strong>{stats.rate}%</strong>
                  </div>
                  <Progress
                    percent={stats.rate}
                    strokeColor={{ '0%': '#108ee9', '100%': '#87d068' }}
                    status={loading ? 'active' : 'normal'}
                    size={12}
                    showInfo={false}
                  />
                  <p className="description mt-4 text-gray-500">{t('completionRateDesc')}</p>
                </div>
              </Card>
            </Col>
            <Col xs={24} lg={8}>
              <Card title={t('focusDistribution')} variant="borderless" className="shadow-sm">
                <div className="priority-distribution">
                  {[
                    { label: 'P1', count: stats.p1, color: 'error', stroke: '#ff4d4f' },
                    { label: 'P2', count: stats.p2, color: 'warning', stroke: '#faad14' },
                    { label: 'P3', count: stats.p3, color: 'processing', stroke: '#1677ff' },
                    { label: 'P4', count: stats.p4, color: 'default', stroke: '#8c8c8c' },
                  ].map((item) => (
                    <div key={item.label} className="dist-item mb-4">
                      <div className="flex justify-between mb-2">
                        <Tag color={item.color}>{item.label}</Tag>
                        <span>{item.count}</span>
                      </div>
                      <Progress
                        percent={stats.total ? (item.count / stats.total) * 100 : 0}
                        size="small"
                        showInfo={false}
                        strokeColor={item.stroke}
                      />
                    </div>
                  ))}
                </div>
              </Card>
            </Col>
          </Row>

          <section className="wisdom-card full mt-6">
            <div className="wisdom-overlay" />
            <div className="wisdom-content">
              <FireOutlined />
              <p>{t('statsWisdomQuote')}</p>
              <span>{t('ritualsOfFocus')}</span>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
