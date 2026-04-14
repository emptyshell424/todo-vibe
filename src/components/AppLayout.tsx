'use client';

import React from 'react';
import { App, Button, ConfigProvider, Input, Modal, Select } from 'antd';
import { GlobalOutlined, BarChartOutlined, CalendarOutlined, CheckCircleOutlined, NotificationOutlined, SearchOutlined, SettingOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Show, SignInButton, UserButton, useUser } from '@clerk/nextjs';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect, useMemo } from 'react';
import { useI18n } from './I18nProvider';

function SidebarAndMain({ children }: { children: React.ReactNode }) {
  const { t, language, setLanguage } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const { message } = App.useApp();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [aiProvider, setAiProvider] = useState<'gemini' | 'openai'>('gemini');
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [aiModel, setAiModel] = useState('');

  useEffect(() => {
    setApiKey(localStorage.getItem('gemini_api_key') || '');
    setAiProvider((localStorage.getItem('ai_provider') as any) || 'gemini');
    setAiBaseUrl(localStorage.getItem('ai_base_url') || '');
    setAiModel(localStorage.getItem('ai_model') || '');
  }, [isSettingsOpen]);

  const handleSaveSettings = () => {
    localStorage.setItem('gemini_api_key', apiKey.trim());
    localStorage.setItem('ai_provider', aiProvider);
    localStorage.setItem('ai_base_url', aiBaseUrl.trim());
    localStorage.setItem('ai_model', aiModel.trim());
    message.success(t('settingsSaved'));
    setIsSettingsOpen(false);
  };

  const navigationItems = useMemo(() => [
    { key: '/', label: t('today'), icon: <CalendarOutlined /> },
    { key: '/scheduled', label: t('scheduled'), icon: <UnorderedListOutlined /> },
    { key: '/completed', label: t('completed'), icon: <CheckCircleOutlined /> },
    { key: '/stats', label: t('statistics'), icon: <BarChartOutlined /> },
  ], [t]);

  const [searchValue, setSearchValue] = useState(searchParams.get('q') || '');

  useEffect(() => {
    setSearchValue(searchParams.get('q') || '');
  }, [searchParams]);

  const handleSearch = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) {
      params.set('q', value.trim());
    } else {
      params.delete('q');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.2"/>
              <path d="M7 12.5L10.5 16L17 8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="brand-info">
            <h1 className="brand-name">Todo Vibe</h1>
            <p className="brand-subtitle">{t('brandSubtitle')}</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navigationItems.map((item) => {
            const active = pathname === item.key;
            const className = active ? 'sidebar-link active' : 'sidebar-link';
            const isDisabled = (item as any).disabled;

            if (isDisabled) {
              return (
                <button key={item.key} type="button" className={className} disabled>
                  <span className="sidebar-link-icon">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            }

            return (
              <button
                key={item.key}
                type="button"
                className={className}
                onClick={() => router.push(item.key)}
              >
                <span className="sidebar-link-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button 
            type="button" 
            className="sidebar-link" 
            onClick={() => setIsSettingsOpen(true)}
          >
            <span className="sidebar-link-icon">
              <SettingOutlined />
            </span>
            <span>{t('settings')}</span>
          </button>

          <div className="focus-chip">
            <div className="focus-chip-avatar">{user?.firstName?.slice(0, 1) ?? 'F'}</div>
            <div>
              <p className="focus-chip-title">{t('focusMode')}</p>
              <p className="focus-chip-text">{t('focusModeDesc')}</p>
            </div>
          </div>

          <Show
            when="signed-out"
            fallback={
              <Button 
                type="primary" 
                size="large" 
                className="sidebar-cta"
                onClick={() => router.push('/?focus=true')}
              >
                {t('newTask')}
              </Button>
            }
          >
            <SignInButton mode="modal">
              <Button type="primary" size="large" className="sidebar-cta">
                {t('signIn')}
              </Button>
            </SignInButton>
          </Show>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div>
            <p className="topbar-kicker secondary-label">{t('personalSanctuary')}</p>
            <h1 className="topbar-title editorial-header">{t('topbarTitle')}</h1>
          </div>

          <div className="topbar-actions">
            <div className="topbar-search">
              <SearchOutlined />
              <Input
                variant="borderless"
                placeholder={t('searchPlaceholder')}
                aria-label={t('searchPlaceholder')}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onPressEnter={() => handleSearch(searchValue)}
                allowClear
              />
            </div>
            <button 
              type="button" 
              className="topbar-icon-button" 
              onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}
              title={language === 'zh' ? 'Switch to English' : '切换至中文'}
            >
              <GlobalOutlined />
            </button>
            <button 
              type="button" 
              className="topbar-icon-button" 
              aria-label={t('notifications')}
              onClick={() => {
                if (!user) {
                  message.info(t('signInToViewNotifications'));
                } else {
                  message.info(t('noNotifications'));
                }
              }}
            >
              <NotificationOutlined />
            </button>
            <div className="topbar-user">
              <Show
                when="signed-in"
                fallback={
                  <SignInButton mode="modal">
                    <Button type="default" className="topbar-signin">
                      {t('signIn')}
                    </Button>
                  </SignInButton>
                }
              >
                <UserButton
                  appearance={{
                    elements: {
                      userButtonAvatarBox: {
                        width: 40,
                        height: 40,
                      },
                    },
                  }}
                />
              </Show>
            </div>
          </div>
        </header>

        <main className="workspace-content">{children}</main>
      </div>

      <Modal
        title={t('settingsTitle')}
        open={isSettingsOpen}
        onCancel={() => setIsSettingsOpen(false)}
        onOk={handleSaveSettings}
        okText={t('saveSettings')}
        cancelText={t('cancel')}
        centered
        width={450}
        className="settings-modal"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingTop: '12px' }}>
          <div className="onboarding-tip" style={{ 
            background: 'var(--color-bg-base)', 
            padding: '12px', 
            borderRadius: '12px',
            fontSize: '13px',
            border: '1px solid #eee'
          }}>
            <span>{t('aiOnboardingPrefix')}</span>
            <a href="https://aihubmix.com/" target="_blank" rel="noopener noreferrer" style={{ color: '#006592', fontWeight: 600 }}>
              {t('aiOnboardingLink')}
            </a>
            <span>{t('aiOnboardingSuffix')}</span>
          </div>

          <div>
            <p style={{ marginBottom: '8px', fontWeight: 600 }}>{t('aiProviderTitle')}</p>
            <Select
              style={{ width: '100%' }}
              value={aiProvider}
              onChange={(val) => setAiProvider(val)}
              options={[
                { value: 'gemini', label: t('aiProviderGemini') },
                { value: 'openai', label: t('aiProviderOpenAI') },
              ]}
            />
          </div>

          <div>
            <p style={{ marginBottom: '8px', fontWeight: 600 }}>{t('geminiApiKeyTitle')}</p>
            <Input.Password
              placeholder={t('geminiApiKeyPlaceholder')}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              variant="filled"
            />
          </div>

          {aiProvider === 'openai' && (
            <div>
              <p style={{ marginBottom: '8px', fontWeight: 600 }}>{t('aiBaseUrlTitle')}</p>
              <Input
                placeholder={t('aiBaseUrlPlaceholder')}
                value={aiBaseUrl}
                onChange={(e) => setAiBaseUrl(e.target.value)}
                variant="filled"
              />
            </div>
          )}

          <div>
            <p style={{ marginBottom: '8px', fontWeight: 600 }}>{t('aiModelTitle')}</p>
            <Input
              placeholder={t('aiModelPlaceholder')}
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              variant="filled"
            />
            {aiProvider === 'gemini' && !aiModel && (
              <p style={{ fontSize: '12px', color: '#999', marginTop: '4px' }}>Default: gemini-1.5-flash</p>
            )}
          </div>

          <div style={{ 
            marginTop: '8px',
            padding: '12px', 
            borderRadius: '12px', 
            background: '#fffbe6', 
            border: '1px solid #ffe58f',
            fontSize: '12px',
            color: '#856404'
          }}>
            <p style={{ fontWeight: 600, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '14px' }}>🛡️</span> {t('securityPrivacyTitle')}
            </p>
            <p style={{ margin: 0, lineHeight: '1.5' }}>{t('securityPrivacyNote')}</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#000000',
          borderRadius: 24,
          fontFamily: '"Playfair Display", serif',
          colorBgContainer: '#ffffff',
          colorBorderSecondary: '#f0f0f0',
        },
        components: {
          Button: {
            borderRadius: 999,
            controlHeight: 40,
            fontWeight: 600,
          },
          Input: {
            borderRadius: 999,
            controlHeight: 40,
          },
          Select: {
            borderRadius: 999,
            controlHeight: 40,
          },
        },
      }}
    >
      <App>
        <Suspense fallback={<div className="workspace-shell"><div className="workspace-main"><p>{t('loadingWorkspace')}</p></div></div>}>
          <SidebarAndMain>{children}</SidebarAndMain>
        </Suspense>
      </App>
    </ConfigProvider>
  );
}
