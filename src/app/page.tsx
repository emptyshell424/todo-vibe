'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Typography, Card, Checkbox, Tag, Input, Button, Space, Flex, Modal, message, Skeleton, notification, Tabs, Empty, Spin } from 'antd';
import { DeleteOutlined, PlusOutlined, ExclamationCircleOutlined, UnorderedListOutlined, SmileOutlined, CheckCircleOutlined, RocketOutlined } from '@ant-design/icons';
import { useUser, SignInButton } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";

const { Title, Text } = Typography;
const { confirm } = Modal;

interface Todo {
  id: string;
  text: string;
  is_completed: boolean;
  priority: string;
  user_id: string;
  created_at: string;
}

export default function Home() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputValue, setInputValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<string>('all');

  // 前端过滤：根据当前标签页过滤任务
  const filteredTodos = useMemo(() => {
    switch (activeTab) {
      case 'active':
        return todos.filter(t => !t.is_completed);
      case 'completed':
        return todos.filter(t => t.is_completed);
      default:
        return todos;
    }
  }, [todos, activeTab]);

  // 统计数据
  const completedCount = useMemo(() => todos.filter(t => t.is_completed).length, [todos]);
  const totalCount = todos.length;

  // 页面加载时从 Supabase 获取当前用户的 todos
  useEffect(() => {
    const fetchTodos = async () => {
      if (!isSignedIn || !user) return;

      setLoading(true);
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        notification.error({
          message: '查询失败',
          description: error.message,
          placement: 'topRight',
        });
      } else {
        setTodos(data || []);
      }
      setLoading(false);
    };

    fetchTodos();
  }, [isSignedIn, user]);

  // 1. 实现"新增"功能 —— 先写数据库，成功后再更新页面
  const handleAdd = async () => {
    if (!inputValue.trim()) {
      message.warning('请输入任务内容');
      return;
    }
    if (!user) return;

    setAdding(true);
    const newTodoData = {
      text: inputValue.trim(),
      is_completed: false,
      priority: 'normal',
      user_id: user.id,
    };

    const { data, error } = await supabase
      .from('todos')
      .insert(newTodoData)
      .select()
      .single();

    if (error) {
      notification.error({
        message: '添加失败',
        description: error.message,
        placement: 'topRight',
      });
    } else {
      setTodos([data, ...todos]);
      setInputValue('');
      message.success('添加成功');
    }
    setAdding(false);
  };

  // 2. 实现"勾选"功能 —— 先更新数据库，成功后再更新页面
  const toggleComplete = async (id: string) => {
    const target = todos.find(t => t.id === id);
    if (!target) return;

    setTogglingIds(prev => new Set(prev).add(id));
    const newStatus = !target.is_completed;

    const { error } = await supabase
      .from('todos')
      .update({ is_completed: newStatus })
      .eq('id', id);

    if (error) {
      notification.error({
        message: '更新失败',
        description: error.message,
        placement: 'topRight',
      });
    } else {
      setTodos(todos.map(todo =>
        todo.id === id ? { ...todo, is_completed: newStatus } : todo
      ));
    }
    setTogglingIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  // 3. 实现"删除"功能（确认框 + 先删数据库再更新页面）
  const handleDelete = (id: string) => {
    confirm({
      title: '确定要删除这个任务吗？',
      icon: <ExclamationCircleOutlined />,
      content: '删除后将无法恢复',
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        setDeletingIds(prev => new Set(prev).add(id));

        const { error } = await supabase
          .from('todos')
          .delete()
          .eq('id', id);

        if (error) {
          notification.error({
            message: '删除失败',
            description: error.message,
            placement: 'topRight',
          });
        } else {
          setTodos(prev => prev.filter(todo => todo.id !== id));
          message.success('删除成功');
        }

        setDeletingIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      },
    });
  };

  if (!isLoaded) {
    return (
      <div style={{ maxWidth: 800, margin: '40px auto', padding: '0 20px' }}>
        <Spin spinning size="large">
          <Flex vertical gap={24}>
            <Skeleton.Input active style={{ width: 200, height: 32, margin: '0 auto', display: 'block' }} />
            <Card variant="borderless" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 16 }}>
              <Skeleton.Input active block style={{ height: 40, marginBottom: 24 }} />
              <Skeleton active paragraph={{ rows: 4, width: ['100%', '90%', '80%', '70%'] }} />
            </Card>
          </Flex>
        </Spin>
      </div>
    );
  }

  if (isSignedIn) {
    return (
      <div className="todo-container">
        <Flex vertical gap={24}>
          <Title level={2} style={{ marginBottom: 0, textAlign: 'center' }}>
            我的待办清单
          </Title>

          <Card variant="borderless" style={{ boxShadow: '0 4px 12px rgba(0,0,0,0.05)', borderRadius: 16 }}>
            <div className="todo-input-area">
              <Input 
                placeholder="想做点什么？" 
                size="large"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onPressEnter={handleAdd}
                disabled={adding}
                className="todo-input"
              />
              <Button 
                type="primary" 
                size="large" 
                icon={<PlusOutlined />} 
                onClick={handleAdd}
                loading={adding}
                className="todo-add-btn"
              >
                添加
              </Button>
            </div>

            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              style={{ marginBottom: 8 }}
              items={[
                {
                  key: 'all',
                  label: `全部 (${totalCount})`,
                },
                {
                  key: 'active',
                  label: `进行中 (${totalCount - completedCount})`,
                },
                {
                  key: 'completed',
                  label: `已完成 (${completedCount})`,
                },
              ]}
            />

            <Spin spinning={loading} description="正在加载任务...">
              <Flex vertical gap={0} style={{ minHeight: loading ? 120 : 'auto' }}>
                {loading ? (
                  <Skeleton active paragraph={{ rows: 4, width: ['100%', '95%', '85%', '75%'] }} />
                ) : filteredTodos.length === 0 ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    style={{ padding: '40px 0' }}
                    description={
                      <Text type="secondary" style={{ fontSize: 15 }}>
                        {activeTab === 'all'
                          ? '暂无任务，快去添加一个吧！'
                          : activeTab === 'active'
                          ? '没有进行中的任务，真棒！🎉'
                          : '还没有已完成的任务，加油！💪'}
                      </Text>
                    }
                  >
                    {activeTab === 'all' && (
                      <Button type="primary" icon={<PlusOutlined />} onClick={() => document.querySelector<HTMLInputElement>('.todo-input input')?.focus()}>
                        去添加任务
                      </Button>
                    )}
                  </Empty>
                ) : filteredTodos.map((item, index) => (
                  <div 
                    key={item.id}
                    className="todo-item"
                    style={{ 
                      padding: '16px 8px',
                      borderBottom: index !== filteredTodos.length - 1 ? '1px solid #f0f0f0' : 'none',
                    }}
                  >
                    <div className="todo-item-left">
                      <Checkbox 
                        checked={item.is_completed} 
                        onChange={() => toggleComplete(item.id)}
                        disabled={togglingIds.has(item.id)}
                      />
                      <div style={{ flex: 1, cursor: togglingIds.has(item.id) ? 'not-allowed' : 'pointer', opacity: togglingIds.has(item.id) ? 0.5 : 1, transition: 'opacity 0.2s' }} onClick={() => !togglingIds.has(item.id) && toggleComplete(item.id)}>
                        <Text 
                          delete={item.is_completed} 
                          style={{ 
                            fontSize: 16, 
                            color: item.is_completed ? '#bfbfbf' : 'rgba(0,0,0,0.85)',
                            transition: 'all 0.3s'
                          }}
                        >
                          {item.text}
                        </Text>
                      </div>
                      <Tag 
                        color={item.priority === 'urgent' ? '#ff4d4f' : '#1677ff'} 
                        variant="filled"
                        className="todo-tag"
                        style={{ 
                          borderRadius: 6, 
                          padding: '0 10px',
                          backgroundColor: item.priority === 'urgent' ? '#fff1f0' : '#e6f4ff',
                          color: item.priority === 'urgent' ? '#cf1322' : '#0958d9'
                        }}
                      >
                        {item.priority === 'urgent' ? '紧急' : '普通'}
                      </Tag>
                    </div>
                    <Button 
                      type="text" 
                      danger 
                      icon={<DeleteOutlined />} 
                      loading={deletingIds.has(item.id)}
                      disabled={deletingIds.has(item.id)}
                      style={{ borderRadius: 8, marginLeft: 12 }}
                      onClick={() => handleDelete(item.id)}
                    />
                  </div>
                ))}
              </Flex>
            </Spin>

            {/* 底部统计信息 */}
            {!loading && totalCount > 0 && (
              <div style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: '1px solid #f0f0f0',
                textAlign: 'center',
              }}>
                <Text type="secondary" style={{ fontSize: 14 }}>
                  总共有 <Text strong style={{ color: '#1677ff' }}>{totalCount}</Text> 个任务，已完成 <Text strong style={{ color: '#52c41a' }}>{completedCount}</Text> 个
                </Text>
              </div>
            )}
          </Card>
        </Flex>
      </div>
    );
  }

  // Signed out state
  return (
    <div className="signed-out-container">
      <Card 
        variant="borderless" 
        className="signed-out-card"
      >
        <div style={{ marginBottom: 32 }}>
          <div style={{ 
            width: 80, 
            height: 80, 
            background: '#1677ff', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            margin: '0 auto 24px',
            boxShadow: '0 8px 16px rgba(22,119,255,0.3)'
          }}>
            <UnorderedListOutlined style={{ fontSize: 40, color: '#fff' }} />
          </div>
          <Title level={2}>欢迎使用 TO-DO-LIST</Title>
          <Text type="secondary" style={{ fontSize: 16 }}>
            极简、高效、有范儿的任务管理工具
          </Text>
        </div>
        
        <div style={{ 
          background: '#f8f9fa', 
          padding: '24px', 
          borderRadius: 16, 
          marginBottom: 32,
          border: '1px solid #f0f0f0'
        }}>
          <Text italic style={{ fontSize: 16, color: '#595959', display: 'block', marginBottom: 8 }}>
            “请先登录后体验功能”
          </Text>
          <Text type="secondary">登录以开启同步、分类及更多高级特性</Text>
        </div>

        <SignInButton mode="modal">
          <Button type="primary" size="large" block style={{ height: 48, borderRadius: 12, fontSize: 16, fontWeight: 600 }}>
            立即登录
          </Button>
        </SignInButton>
      </Card>
    </div>
  );
}


