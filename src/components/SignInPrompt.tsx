'use client';

import React from 'react';
import { Button, Typography } from 'antd';
import { RobotOutlined, CheckCircleOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { SignInButton } from '@clerk/nextjs';
import { useI18n } from './I18nProvider';

const { Title, Text } = Typography;

export default function SignInPrompt() {
  const { t } = useI18n();

  return (
    <div className="signed-out-hero">
      <div className="signed-out-copy">
        <span className="eyebrow">{t('heroEyebrow')}</span>
        <Title>{t('heroTitle')}</Title>
        <Text>{t('heroDesc')}</Text>
        <div className="signed-out-actions">
          <SignInButton mode="modal">
            <Button type="primary" size="large">
              {t('signInNow')}
            </Button>
          </SignInButton>
          <SignInButton mode="modal">
            <Button size="large" icon={<RobotOutlined />}>
              {t('aiBreakdownExample')}
            </Button>
          </SignInButton>
        </div>
      </div>

      <div className="signed-out-preview">
        <div className="preview-orb" />
        <div className="preview-card">
          <span className="eyebrow">Focus workflow</span>
          <h3>{t('startWithGoal')}</h3>
          <p>{t('startWithGoalDesc')}</p>
          <div className="preview-list">
            <div>
              <CheckCircleOutlined />
              <span>{t('saveAndSync')}</span>
            </div>
            <div>
              <RobotOutlined />
              <span>{t('oneClickBreakdown')}</span>
            </div>
            <div>
              <ThunderboltOutlined />
              <span>{t('allInOne')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
