'use client';

import React from 'react';
import { Layout, Menu, Button, ConfigProvider, theme } from 'antd';
import { UnorderedListOutlined } from '@ant-design/icons';
import { usePathname, useRouter } from 'next/navigation';
import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import zhCN from 'antd/locale/zh_CN';

const { Header, Content, Sider } = Layout;

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname();
  const router = useRouter();

  const menuItems = [
    {
      key: '/',
      icon: <UnorderedListOutlined />,
      label: '我的任务',
      onClick: () => router.push('/'),
    },
  ];

  return (
    <ConfigProvider locale={zhCN}>
      <Layout className="main-layout" style={{ minHeight: '100vh' }}>
        <Sider
          breakpoint="lg"
          collapsedWidth="0"
          theme="dark"
          width={240}
        >
          <div className="logo-container" style={{ 
            height: 64, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            fontSize: 20,
            fontWeight: 'bold',
            color: '#fff'
          }}>
            TO-DO-LIST
          </div>
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[pathname]}
            items={menuItems}
            style={{ marginTop: 16 }}
          />
        </Sider>
        <Layout>
          <Header className="header" style={{ 
            background: '#fff', 
            padding: '0 24px', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'flex-end',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
          }}>
            <Show when="signed-out">
              <SignInButton mode="modal">
                <Button type="primary">登录</Button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <UserButton 
                appearance={{
                  elements: {
                    userButtonAvatarBox: {
                      width: 40,
                      height: 40
                    }
                  }
                }}
              />
            </Show>
          </Header>
          <Content className="content" style={{ margin: '24px 16px', padding: 24, background: '#fff', borderRadius: 8 }}>
            {children}
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  );
};

export default AppLayout;
