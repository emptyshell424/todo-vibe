export type ApiErrorPayload = {
  code: string;
  message: string;
};

export type ReminderNotificationPayload = {
  id: string;
  taskId: string;
  taskTitle: string;
  remindAt: string;
  sentAt: string | null;
  dueAt: string | null;
  projectId: string | null;
  sectionId: string | null;
};

export type ReminderPollResponse = {
  reminders: ReminderNotificationPayload[];
  polledAt: string;
};

export function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as ApiErrorPayload).code === 'string' &&
    typeof (value as ApiErrorPayload).message === 'string'
  );
}

export function getApiErrorMessage(value: unknown, fallback: string) {
  if (isApiErrorPayload(value)) {
    return value.message;
  }

  if (value && typeof value === 'object' && typeof (value as { error?: unknown }).error === 'string') {
    return (value as { error: string }).error;
  }

  return fallback;
}

export function isReminderPollResponse(value: unknown): value is ReminderPollResponse {
  return (
    !!value &&
    typeof value === 'object' &&
    typeof (value as ReminderPollResponse).polledAt === 'string' &&
    Array.isArray((value as ReminderPollResponse).reminders)
  );
}
