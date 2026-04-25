'use client';

import { useEffect, useEffectEvent, useRef } from 'react';
import { App } from 'antd';
import { useUser } from '@clerk/nextjs';
import { getApiErrorMessage, isReminderPollResponse } from '@/lib/api';
import { useI18n } from './I18nProvider';

const REMINDER_POLL_INTERVAL_MS = 60_000;
const ERROR_NOTIFICATION_COOLDOWN_MS = 5 * 60_000;

export default function ReminderNotifier() {
  const { notification } = App.useApp();
  const { t } = useI18n();
  const { isLoaded, isSignedIn } = useUser();
  const isPollingRef = useRef(false);
  const shownReminderIdsRef = useRef<Set<string>>(new Set());
  const lastErrorNotificationAtRef = useRef(0);

  const showPollingError = useEffectEvent((message: string) => {
    const now = Date.now();
    if (now - lastErrorNotificationAtRef.current < ERROR_NOTIFICATION_COOLDOWN_MS) {
      return;
    }

    lastErrorNotificationAtRef.current = now;
    notification.error({
      title: t('reminderReadyTitle'),
      description: message,
      placement: 'topRight',
    });
  });

  const pollReminders = useEffectEvent(async () => {
    if (!isLoaded || !isSignedIn || isPollingRef.current) {
      return;
    }

    isPollingRef.current = true;

    try {
      const response = await fetch('/api/reminders/poll', {
        method: 'POST',
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        showPollingError(getApiErrorMessage(payload, t('reminderSyncFailed')));
        return;
      }

      if (!isReminderPollResponse(payload)) {
        showPollingError(t('reminderSyncFailed'));
        return;
      }

      for (const reminder of payload.reminders) {
        if (shownReminderIdsRef.current.has(reminder.id)) {
          continue;
        }

        shownReminderIdsRef.current.add(reminder.id);
        notification.info({
          key: `reminder:${reminder.id}`,
          title: t('reminderReadyTitle'),
          description: t('reminderReadyDesc', {
            title: reminder.taskTitle || t('reminderTaskFallback'),
          }),
          placement: 'topRight',
          duration: 6,
        });
      }
    } catch {
      showPollingError(t('reminderSyncFailed'));
    } finally {
      isPollingRef.current = false;
    }
  });

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      shownReminderIdsRef.current.clear();
      return;
    }

    void pollReminders();
    const intervalId = window.setInterval(() => {
      void pollReminders();
    }, REMINDER_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isLoaded, isSignedIn]);

  return null;
}
