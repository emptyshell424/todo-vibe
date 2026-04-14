'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button, Checkbox, Input, type InputRef, Tag } from 'antd';
import { CheckOutlined, CloseOutlined, CalendarOutlined, ClockCircleOutlined, DeleteOutlined, EditOutlined, RobotOutlined } from '@ant-design/icons';
import { useI18n } from './I18nProvider';

export interface Todo {
  id: string;
  text: string;
  is_completed: boolean;
  priority: string;
  user_id: string;
  created_at: string;
}

export type ParsedTodo = Todo & {
  displayText: string;
  groupTitle: string | null;
  due_date: string | null;
};

interface TodoItemProps {
  item: ParsedTodo;
  index: number;
  togglingIds: Set<string>;
  deletingIds: Set<string>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Todo>) => Promise<void>;
}

function formatTimeLabel(todo: Todo, index: number, language: string) {
  const createdAt = new Date(todo.created_at);
  if (!Number.isNaN(createdAt.getTime())) {
    return createdAt.toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  const fallbackHour = 9 + (index % 7);
  return `${String(fallbackHour).padStart(2, '0')}:00`;
}

export default function TodoItem({
  item,
  index,
  togglingIds,
  deletingIds,
  onToggle,
  onDelete,
  onUpdate,
}: TodoItemProps) {
  const { t, language } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(item.displayText);
  const [updating, setUpdating] = useState(false);
  const editInputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    const trimmed = editText.trim();
    if (!trimmed) {
      setIsEditing(false);
      setEditText(item.displayText);
      return;
    }

    if (trimmed === item.displayText) {
      setIsEditing(false);
      return;
    }

    setUpdating(true);
    await onUpdate(item.id, { text: trimmed });
    setUpdating(false);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditText(item.displayText);
    setIsEditing(false);
  };

  const handleTogglePriority = async () => {
    const nextPriority = item.priority === 'urgent' ? 'normal' : 'urgent';
    await onUpdate(item.id, { priority: nextPriority });
  };

  return (
    <article className={`task-row${item.is_completed ? ' is-complete' : ''}${isEditing ? ' is-editing' : ''}`}>
      <div className="task-row-main">
        <Checkbox
          checked={item.is_completed}
          onChange={() => onToggle(item.id)}
          disabled={togglingIds.has(item.id) || updating}
        />
        <div className="task-row-copy">
          {isEditing ? (
            <Input
              ref={editInputRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onPressEnter={handleSave}
              onBlur={handleSave}
              disabled={updating}
              variant="borderless"
              className="edit-input"
            />
          ) : (
            <h4 onClick={() => !item.is_completed && setIsEditing(true)}>{item.displayText}</h4>
          )}
          <div className="task-row-meta">
            <span>
              <ClockCircleOutlined />
              {formatTimeLabel(item, index, language)}
            </span>
            {item.groupTitle ? (
              <span>
                <RobotOutlined />
                {item.groupTitle}
              </span>
            ) : item.due_date ? (
              <span>
                <CalendarOutlined />
                {new Date(item.due_date).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US')}
              </span>
            ) : (
              <span>
                <CalendarOutlined />
                {t('today')}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="task-row-actions">
        {!isEditing && (
          <>
            <Tag
              color={item.priority === 'urgent' ? 'error' : 'processing'}
              variant="filled"
              className="priority-tag"
              onClick={handleTogglePriority}
              style={{ cursor: 'pointer' }}
            >
              {item.priority === 'urgent' ? t('highFocus') : t('steadyPace')}
            </Tag>
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => setIsEditing(true)}
              disabled={updating || deletingIds.has(item.id)}
            />
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              loading={deletingIds.has(item.id)}
              disabled={deletingIds.has(item.id) || updating}
              onClick={() => onDelete(item.id)}
            />
          </>
        )}
        {isEditing && (
          <div className="edit-actions">
            <Button type="text" icon={<CheckOutlined />} onClick={handleSave} loading={updating} />
            <Button type="text" icon={<CloseOutlined />} onClick={handleCancel} disabled={updating} />
          </div>
        )}
      </div>
    </article>
  );
}
