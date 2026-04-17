'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button, Checkbox, Input, type InputRef } from 'antd';
import { 
  CheckOutlined, 
  CloseOutlined, 
  ClockCircleOutlined, 
  DeleteOutlined, 
  EditOutlined, 
  RobotOutlined,
  MoreOutlined
} from '@ant-design/icons';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from './I18nProvider';
import { encodeAiBreakdownText, encodeNormalTodoText } from '@/lib/todoUtils';

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
    let encodedText = trimmed;
    if (item.groupTitle) {
      encodedText = encodeAiBreakdownText(item.groupTitle, trimmed, item.due_date || undefined);
    } else if (item.due_date) {
      encodedText = encodeNormalTodoText(trimmed, item.due_date);
    }

    await onUpdate(item.id, { text: encodedText });
    setUpdating(false);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditText(item.displayText);
    setIsEditing(false);
  };

  const handleTogglePriority = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextPriority = item.priority === 'urgent' ? 'normal' : 'urgent';
    await onUpdate(item.id, { priority: nextPriority });
  };

  return (
    <motion.article 
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2 }}
      transition={{ 
        type: 'spring',
        stiffness: 400,
        damping: 30,
        mass: 0.8
      }}
      className={`task-row${item.is_completed ? ' is-complete' : ''}${isEditing ? ' is-editing' : ''}`}
    >
      <div className="task-row-main">
        <motion.div 
          className="checkbox-wrapper"
          whileTap={{ scale: 0.8 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          <Checkbox
            checked={item.is_completed}
            onChange={() => onToggle(item.id)}
            disabled={togglingIds.has(item.id) || updating}
          />
        </motion.div>
        
        <div className="task-row-copy">
          <AnimatePresence mode="wait">
            {isEditing ? (
              <motion.div
                key="editing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
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
              </motion.div>
            ) : (
              <motion.h4 
                key="static"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                onClick={() => !item.is_completed && setIsEditing(true)}
                style={{ cursor: item.is_completed ? 'default' : 'text' }}
              >
                {item.displayText}
              </motion.h4>
            )}
          </AnimatePresence>

          <div className="task-row-meta">
            <span className="meta-time">
              {formatTimeLabel(item, index, language)}
            </span>
            {item.groupTitle && (
              <span className="meta-group">
                <RobotOutlined size={10} /> {item.groupTitle}
              </span>
            )}
            <motion.span 
              className={`meta-priority ${item.priority}`} 
              onClick={handleTogglePriority}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              {item.priority === 'urgent' ? t('highFocus') : t('steadyPace')}
            </motion.span>
          </div>
        </div>
      </div>

      <div className="task-row-actions">
        <AnimatePresence>
          {!isEditing ? (
            <motion.div 
              className="action-group"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => setIsEditing(true)}
                disabled={updating || deletingIds.has(item.id)}
              />
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                loading={deletingIds.has(item.id)}
                disabled={deletingIds.has(item.id) || updating}
                onClick={() => onDelete(item.id)}
              />
            </motion.div>
          ) : (
            <motion.div 
              className="edit-actions"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
            >
              <Button type="text" size="small" icon={<CheckOutlined />} onClick={handleSave} loading={updating} />
              <Button type="text" size="small" icon={<CloseOutlined />} onClick={handleCancel} disabled={updating} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}
