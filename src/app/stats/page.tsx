'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import {
  App,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Skeleton,
  Spin,
  Statistic,
  Tag,
  Typography,
} from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  DashboardOutlined,
  FireOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useUser } from '@clerk/nextjs';
import { supabase } from '@/lib/supabaseClient';
import { useI18n } from '@/components/I18nProvider';
import SignInPrompt from '@/components/SignInPrompt';

const { Title, Text } = Typography;

export default function StatsPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="workspace-home"><Skeleton active paragraph={{ rows: 10 }} /></div>}>
      <StatsContent />
    </Suspense>
  );
}

function StatsContent() {
  const { t } = useI18n();
  const { isLoaded, isSignedIn, user } = useUser();
  const { notification } = App.useApp();

  const [todos, setTodos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        .eq('user_id', user.id);

      if (error) {
        notification.error({
          title: t('loadStatsFailed'),
          description: error.message,
        });
      } else {
        setTodos(data || []);
      }

      setLoading(false);
    };

    fetchTodos();
  }, [isSignedIn, notification, user, t]);

  const stats = useMemo(() => {
    const total = todos.length;
    const completed = todos.filter((t) => t.is_completed).length;
    const active = total - completed;
    const rate = total === 0 ? 0 : Math.round((completed / total) * 100);
    
    // Priority distribution
    const urgent = todos.filter(t => t.priority === 'urgent').length;
    const normal = total - urgent;

    // AI groups
    const aiGroups = todos.filter(t => t.text.includes('[[AI_BREAKDOWN]]')).length;

    return { total, completed, active, rate, urgent, normal, aiGroups };
  }, [todos]);

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
          <span className="eyebrow">Insights & Metrics</span>
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
              <Statistic
                title={t('totalTasks')}
                value={stats.total}
                prefix={<DashboardOutlined />}
                styles={{ content: { color: '#006592' } }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="borderless" className="metric-card shadow-sm">
              <Statistic
                title={t('completed')}
                value={stats.completed}
                prefix={<CheckCircleOutlined />}
                styles={{ content: { color: '#52c41a' } }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="borderless" className="metric-card shadow-sm">
              <Statistic
                title={t('pending')}
                value={stats.active}
                prefix={<ClockCircleOutlined />}
                styles={{ content: { color: '#1890ff' } }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card variant="borderless" className="metric-card shadow-sm">
              <Statistic
                title={t('aiAssisted')}
                value={stats.aiGroups}
                prefix={<ThunderboltOutlined />}
                styles={{ content: { color: '#722ed1' } }}
              />
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
                     status="active"
                     size={12}
                     showInfo={false}
                    />
                   <p className="description mt-4 text-gray-500">
                     {t('completionRateDesc')}
                   </p>
                 </div>
               </Card>
             </Col>
             <Col xs={24} lg={8}>
               <Card title={t('focusDistribution')} variant="borderless" className="shadow-sm">
                 <div className="priority-distribution">
                   <div className="dist-item mb-4">
                     <div className="flex justify-between mb-2">
                        <Tag color="error">{t('highFocus')} (Urgent)</Tag>
                        <span>{stats.urgent}</span>
                     </div>
                     <Progress percent={stats.total ? (stats.urgent / stats.total) * 100 : 0} size="small" showInfo={false} strokeColor="#ff4d4f" />
                   </div>
                   <div className="dist-item">
                     <div className="flex justify-between mb-2">
                        <Tag color="processing">{t('steadyPace')} (Normal)</Tag>
                        <span>{stats.normal}</span>
                     </div>
                     <Progress percent={stats.total ? (stats.normal / stats.total) * 100 : 0} size="small" showInfo={false} strokeColor="#1890ff" />
                   </div>
                 </div>
               </Card>
             </Col>
           </Row>

           <section className="wisdom-card full mt-6">
            <div className="wisdom-overlay" />
            <div className="wisdom-content">
              <FireOutlined />
              <p>{t('statsWisdomQuote')}</p>
              <span>The Rituals of Focus</span>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
