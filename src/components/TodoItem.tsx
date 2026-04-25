'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button, Checkbox, DatePicker, Input, Select, type InputRef } from 'antd';
import { CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, PlusOutlined, RobotOutlined } from '@ant-design/icons';
import dayjs, { type Dayjs } from 'dayjs';
import { motion, AnimatePresence } from 'framer-motion';
import { useI18n } from './I18nProvider';
import {
  type DisplayTask,
  type Label,
  type Project,
  type Recurrence,
  type RecurrenceRule,
  type Reminder,
  type Section,
  type Task,
  type TaskPriority,
  formatPriorityLabel,
  formatTaskTimeLabel,
} from '@/lib/taskModel';

export type { DisplayTask, Task } from '@/lib/taskModel';

interface TodoItemProps {
  item: DisplayTask;
  togglingIds: Set<string>;
  deletingIds: Set<string>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Task>) => Promise<void>;
  onCreateSubtask?: (parent: DisplayTask, title: string) => Promise<void>;
  onUpdateMetadata?: (
    task: DisplayTask,
    metadata: {
      labelIds?: string[];
      reminderAt?: string | null;
      recurrenceRule?: RecurrenceRule | null;
    }
  ) => Promise<void>;
  projects?: Project[];
  sections?: Section[];
  parentCandidates?: DisplayTask[];
  labels?: Label[];
  taskLabelIds?: string[];
  reminder?: Reminder | null;
  recurrence?: Recurrence | null;
}

const INBOX_PROJECT_SELECT_VALUE = '__inbox__';
const NO_SECTION_SELECT_VALUE = '__no_section__';
const NO_PARENT_SELECT_VALUE = '__no_parent__';

function getNextPriority(priority: TaskPriority): TaskPriority {
  if (priority === 4) {
    return 1;
  }

  return (priority + 1) as TaskPriority;
}

export default function TodoItem({
  item,
  togglingIds,
  deletingIds,
  onToggle,
  onDelete,
  onUpdate,
  onCreateSubtask,
  onUpdateMetadata,
  projects = [],
  sections = [],
  parentCandidates = [],
  labels = [],
  taskLabelIds = [],
  reminder = null,
  recurrence = null,
}: TodoItemProps) {
  const { language, t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editNotes, setEditNotes] = useState(item.notes);
  const [editDueAt, setEditDueAt] = useState<string | null>(item.due_at);
  const [editProjectId, setEditProjectId] = useState<string | null>(item.project_id);
  const [editSectionId, setEditSectionId] = useState<string | null>(item.section_id);
  const [editParentId, setEditParentId] = useState<string | null>(item.parent_id);
  const [editLabelIds, setEditLabelIds] = useState<string[]>(taskLabelIds);
  const [editReminderAt, setEditReminderAt] = useState<string | null>(reminder?.remind_at ?? null);
  const [editRecurrenceRule, setEditRecurrenceRule] = useState<RecurrenceRule | null>(
    recurrence?.rule === 'daily' || recurrence?.rule === 'weekly' || recurrence?.rule === 'weekdays'
      ? recurrence.rule
      : null
  );
  const [isAddingSubtask, setIsAddingSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState('');
  const [updating, setUpdating] = useState(false);
  const editInputRef = useRef<InputRef>(null);

  useEffect(() => {
    if (!isEditing) {
      setEditTitle(item.title);
      setEditNotes(item.notes);
      setEditDueAt(item.due_at);
      setEditProjectId(item.project_id);
      setEditSectionId(item.section_id);
      setEditParentId(item.parent_id);
      setEditLabelIds(taskLabelIds);
      setEditReminderAt(reminder?.remind_at ?? null);
      setEditRecurrenceRule(
        recurrence?.rule === 'daily' || recurrence?.rule === 'weekly' || recurrence?.rule === 'weekdays'
          ? recurrence.rule
          : null
      );
    }
  }, [isEditing, item.due_at, item.notes, item.parent_id, item.project_id, item.section_id, item.title, recurrence, reminder, taskLabelIds]);

  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    const title = editTitle.trim();
    if (!title) {
      setEditTitle(item.title);
      setIsEditing(false);
      return;
    }

    const notes = editNotes.trim();
    const updates: Partial<Task> = {};

    if (title !== item.title) {
      updates.title = title;
    }

    if (notes !== item.notes) {
      updates.notes = notes;
    }

    if (editDueAt !== item.due_at) {
      updates.due_at = editDueAt;
    }

    if (editProjectId !== item.project_id) {
      updates.project_id = editProjectId;
      updates.section_id = editSectionId;
    } else if (editSectionId !== item.section_id) {
      updates.section_id = editSectionId;
    }

    if (editParentId !== item.parent_id) {
      updates.parent_id = editParentId;
    }

    if (Object.keys(updates).length === 0) {
      setIsEditing(false);
      return;
    }

    setUpdating(true);
    try {
      await onUpdate(item.id, updates);
      if (onUpdateMetadata) {
        const labelIdsChanged =
          editLabelIds.length !== taskLabelIds.length || editLabelIds.some((labelId) => !taskLabelIds.includes(labelId));
        const reminderChanged = editReminderAt !== (reminder?.remind_at ?? null);
        const recurrenceChanged = editRecurrenceRule !== (recurrence?.rule ?? null);

        if (labelIdsChanged || reminderChanged || recurrenceChanged) {
          await onUpdateMetadata(item, {
            labelIds: labelIdsChanged ? editLabelIds : undefined,
            reminderAt: reminderChanged ? editReminderAt : undefined,
            recurrenceRule: recurrenceChanged ? editRecurrenceRule : undefined,
          });
        }
      }
      setIsEditing(false);
    } finally {
      setUpdating(false);
    }
  };

  const handleCancel = () => {
    setEditTitle(item.title);
    setEditNotes(item.notes);
    setEditDueAt(item.due_at);
    setEditProjectId(item.project_id);
    setEditSectionId(item.section_id);
    setEditParentId(item.parent_id);
    setEditLabelIds(taskLabelIds);
    setEditReminderAt(reminder?.remind_at ?? null);
    setEditRecurrenceRule(
      recurrence?.rule === 'daily' || recurrence?.rule === 'weekly' || recurrence?.rule === 'weekdays'
        ? recurrence.rule
        : null
    );
    setIsEditing(false);
  };

  const handleTogglePriority = async (event: React.MouseEvent) => {
    event.stopPropagation();
    await onUpdate(item.id, { priority: getNextPriority(item.priority) });
  };

  const handleDueAtChange = (value: Dayjs | null) => {
    setEditDueAt(value ? value.startOf('day').toISOString() : null);
  };

  const handleCreateSubtask = async () => {
    const title = subtaskTitle.trim();
    if (!title || !onCreateSubtask) {
      return;
    }

    setUpdating(true);
    try {
      await onCreateSubtask(item, title);
      setSubtaskTitle('');
      setIsAddingSubtask(false);
    } finally {
      setUpdating(false);
    }
  };

  const projectSections = sections.filter((section) => section.project_id === editProjectId);
  const availableParents = parentCandidates.filter((candidate) => candidate.id !== item.id && candidate.parent_id !== item.id);

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
        mass: 0.8,
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
              <motion.div key="editing" className="task-edit-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Input
                  ref={editInputRef}
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  onPressEnter={handleSave}
                  disabled={updating}
                  variant="borderless"
                  className="edit-input"
                />
                <Input.TextArea
                  value={editNotes}
                  onChange={(event) => setEditNotes(event.target.value)}
                  placeholder={t('notesPlaceholder')}
                  autoSize={{ minRows: 2, maxRows: 4 }}
                  disabled={updating}
                  variant="borderless"
                  className="edit-notes-input"
                />
                <div className="task-edit-meta">
                  <Select
                    value={editProjectId ?? INBOX_PROJECT_SELECT_VALUE}
                    onChange={(value) => {
                      const nextProjectId = value === INBOX_PROJECT_SELECT_VALUE ? null : String(value);
                      setEditProjectId(nextProjectId);
                      setEditSectionId(null);
                    }}
                    options={[
                      { label: t('inboxProject'), value: INBOX_PROJECT_SELECT_VALUE },
                      ...projects.map((project) => ({ label: project.name, value: project.id })),
                    ]}
                    size="small"
                    style={{ minWidth: 132 }}
                    disabled={updating}
                  />
                  <Select
                    value={editSectionId ?? NO_SECTION_SELECT_VALUE}
                    onChange={(value) => {
                      setEditSectionId(value === NO_SECTION_SELECT_VALUE ? null : String(value));
                    }}
                    options={[
                      { label: t('noSection'), value: NO_SECTION_SELECT_VALUE },
                      ...projectSections.map((section) => ({ label: section.name, value: section.id })),
                    ]}
                    size="small"
                    style={{ minWidth: 132 }}
                    disabled={updating || !editProjectId}
                  />
                  <DatePicker
                    value={editDueAt ? dayjs(editDueAt) : null}
                    onChange={handleDueAtChange}
                    allowClear
                    placeholder={t('scheduleOptional')}
                    disabled={updating}
                    size="small"
                  />
                  {editDueAt && (
                    <Button type="text" size="small" onClick={() => setEditDueAt(null)} disabled={updating}>
                      {t('clearDueDate')}
                    </Button>
                  )}
                  <Select
                    value={editParentId ?? NO_PARENT_SELECT_VALUE}
                    onChange={(value) => {
                      setEditParentId(value === NO_PARENT_SELECT_VALUE ? null : String(value));
                    }}
                    options={[
                      { label: t('noParentTask'), value: NO_PARENT_SELECT_VALUE },
                      ...availableParents.map((task) => ({ label: task.title, value: task.id })),
                    ]}
                    size="small"
                    style={{ minWidth: 160 }}
                    disabled={updating}
                    showSearch
                    optionFilterProp="label"
                  />
                  <Select
                    mode="multiple"
                    value={editLabelIds}
                    onChange={setEditLabelIds}
                    options={labels.map((label) => ({ label: label.name, value: label.id }))}
                    size="small"
                    style={{ minWidth: 180 }}
                    placeholder={t('labels')}
                    disabled={updating}
                    optionFilterProp="label"
                  />
                  <DatePicker
                    value={editReminderAt ? dayjs(editReminderAt) : null}
                    onChange={(value: Dayjs | null) => setEditReminderAt(value ? value.toISOString() : null)}
                    showTime
                    allowClear
                    placeholder={t('reminderOptional')}
                    disabled={updating}
                    size="small"
                  />
                  <Select
                    value={editRecurrenceRule ?? 'none'}
                    onChange={(value) => setEditRecurrenceRule(value === 'none' ? null : (value as RecurrenceRule))}
                    options={[
                      { label: t('noRecurrence'), value: 'none' },
                      { label: t('daily'), value: 'daily' },
                      { label: t('weekly'), value: 'weekly' },
                      { label: t('weekdays'), value: 'weekdays' },
                    ]}
                    size="small"
                    style={{ minWidth: 150 }}
                    disabled={updating}
                  />
                </div>
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
                {item.title}
              </motion.h4>
            )}
          </AnimatePresence>

          {!isEditing && (
            <>
              {item.notes && <p className="task-row-notes">{item.notes}</p>}
              <div className="task-row-meta">
                <span className="meta-time">{formatTaskTimeLabel(item, language)}</span>
                {taskLabelIds.length > 0 && <span className="meta-group">{taskLabelIds.length} {t('labels')}</span>}
                {reminder && <span className="meta-group">{t('reminder')}</span>}
                {recurrence && <span className="meta-group">{t('recurring')}</span>}
                {item.parentTitle && (
                  <span className="meta-group">
                    <RobotOutlined /> {item.parentTitle}
                  </span>
                )}
                <motion.span
                  className={`meta-priority ${item.priority === 4 ? 'urgent' : 'normal'}`}
                  onClick={handleTogglePriority}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  {formatPriorityLabel(item.priority)}
                </motion.span>
              </div>
              {isAddingSubtask && (
                <div className="task-edit-meta" style={{ marginTop: 8 }}>
                  <Input
                    value={subtaskTitle}
                    onChange={(event) => setSubtaskTitle(event.target.value)}
                    onPressEnter={handleCreateSubtask}
                    placeholder={t('subtaskPlaceholder')}
                    disabled={updating}
                    size="small"
                  />
                  <Button type="primary" size="small" onClick={handleCreateSubtask} loading={updating}>
                    {t('addTask')}
                  </Button>
                  <Button type="text" size="small" onClick={() => setIsAddingSubtask(false)} disabled={updating}>
                    {t('cancel')}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="task-row-actions">
        <AnimatePresence>
          {!isEditing ? (
            <motion.div className="action-group" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => setIsEditing(true)}
                disabled={updating || deletingIds.has(item.id)}
              />
              {onCreateSubtask && (
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => setIsAddingSubtask(true)}
                  disabled={updating || deletingIds.has(item.id)}
                  title={t('addSubtask')}
                />
              )}
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
            <motion.div className="edit-actions" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
              <Button type="text" size="small" icon={<CheckOutlined />} onClick={handleSave} loading={updating} />
              <Button type="text" size="small" icon={<CloseOutlined />} onClick={handleCancel} disabled={updating} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.article>
  );
}
