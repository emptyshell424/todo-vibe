'use client';

import React from 'react';
import { App, Button, ConfigProvider, Input } from 'antd';
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
            onClick={() => message.info(language === 'zh' ? '设置功能即将上线' : 'Settings coming soon')}
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
              onClick={() => message.info(language === 'zh' ? '暂无新通知' : 'No new notifications')}
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
