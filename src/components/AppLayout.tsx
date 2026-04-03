'use client';

import React from 'react';
import { App, Button, ConfigProvider, Input } from 'antd';
import {
  BarChartOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  NotificationOutlined,
  SearchOutlined,
  SettingOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { Show, SignInButton, UserButton, useUser } from '@clerk/nextjs';
import { usePathname, useRouter } from 'next/navigation';
import zhCN from 'antd/locale/zh_CN';

const navigationItems = [
  { key: '/', label: 'Today', icon: <CalendarOutlined /> },
  { key: '/scheduled', label: 'Scheduled', icon: <UnorderedListOutlined />, disabled: true },
  { key: '/completed', label: 'Completed', icon: <CheckCircleOutlined />, disabled: true },
  { key: '/stats', label: 'Statistics', icon: <BarChartOutlined />, disabled: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();

  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        token: {
          colorPrimary: '#006592',
          borderRadius: 16,
          colorBgBase: '#f8f9fd',
          fontFamily: 'var(--font-sans)',
        },
      }}
    >
      <App>
        <div className="workspace-shell">
          <aside className="workspace-sidebar">
            <div className="brand-lockup">
              <div className="brand-mark">TV</div>
              <div>
                <p className="brand-name">Todo Vibe</p>
                <p className="brand-subtitle">Focus Workspace</p>
              </div>
            </div>

            <nav className="sidebar-nav">
              {navigationItems.map((item) => {
                const active = pathname === item.key;
                const className = active ? 'sidebar-link active' : 'sidebar-link';

                if (item.disabled) {
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
              <button type="button" className="sidebar-link" disabled>
                <span className="sidebar-link-icon">
                  <SettingOutlined />
                </span>
                <span>Settings</span>
              </button>

              <div className="focus-chip">
                <div className="focus-chip-avatar">{user?.firstName?.slice(0, 1) ?? 'F'}</div>
                <div>
                  <p className="focus-chip-title">Focus mode</p>
                  <p className="focus-chip-text">Stay present, one task at a time.</p>
                </div>
              </div>

              <Show
                when="signed-out"
                fallback={
                  <Button type="primary" size="large" className="sidebar-cta">
                    New Task
                  </Button>
                }
              >
                <SignInButton mode="modal">
                  <Button type="primary" size="large" className="sidebar-cta">
                    Sign In
                  </Button>
                </SignInButton>
              </Show>
            </div>
          </aside>

          <div className="workspace-main">
            <header className="workspace-topbar">
              <div>
                <p className="topbar-kicker">Personal Sanctuary</p>
                <h1 className="topbar-title">Plan your day with calm structure</h1>
              </div>

              <div className="topbar-actions">
                <div className="topbar-search">
                  <SearchOutlined />
                  <Input
                    variant="borderless"
                    placeholder="Search intentions..."
                    aria-label="Search intentions"
                  />
                </div>
                <button type="button" className="topbar-icon-button" aria-label="Notifications">
                  <NotificationOutlined />
                </button>
                <div className="topbar-user">
                  <Show
                    when="signed-in"
                    fallback={
                      <SignInButton mode="modal">
                        <Button type="default" className="topbar-signin">
                          Sign In
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
      </App>
    </ConfigProvider>
  );
}
