import { type Todo, type ParsedTodo } from '@/components/TodoItem';

export const AI_BREAKDOWN_PREFIX = '[[AI_BREAKDOWN]]';

export interface TodoMetadata {
  goal?: string;
  title?: string;
  due_date?: string; // ISO string
}

export function parseTodo(todo: Todo): ParsedTodo {
  if (!todo.text.startsWith(AI_BREAKDOWN_PREFIX)) {
    return {
      ...todo,
      displayText: todo.text,
      groupTitle: null,
      due_date: null,
    };
  }

  const payload = todo.text.slice(AI_BREAKDOWN_PREFIX.length);

  try {
    const parsed = JSON.parse(payload) as TodoMetadata;
    const goal = typeof parsed.goal === 'string' ? parsed.goal.trim() : '';
    const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
    const dueDate = typeof parsed.due_date === 'string' ? parsed.due_date : null;

    if (!title) {
      throw new Error('Invalid AI breakdown payload: title is required');
    }

    return {
      ...todo,
      displayText: title,
      groupTitle: goal || null,
      due_date: dueDate,
    };
  } catch {
    return {
      ...todo,
      displayText: todo.text,
      groupTitle: null,
      due_date: null,
    };
  }
}

export function encodeAiBreakdownText(goal: string, title: string, dueDate?: string) {
  const metadata: TodoMetadata = {
    goal: goal.trim(),
    title: title.trim(),
    due_date: dueDate,
  };
  return `${AI_BREAKDOWN_PREFIX}${JSON.stringify(metadata)}`;
}

export function encodeNormalTodoText(title: string, dueDate?: string) {
  if (!dueDate) return title;
  const metadata: TodoMetadata = {
    title: title.trim(),
    due_date: dueDate,
  };
  return `${AI_BREAKDOWN_PREFIX}${JSON.stringify(metadata)}`;
}
