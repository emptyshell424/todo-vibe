import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const tokenA = process.env.RLS_TOKEN_USER_A;
const tokenB = process.env.RLS_TOKEN_USER_B;

function decodeJwtPayload(token) {
  const [, payload] = token.split('.');
  if (!payload) {
    throw new Error('Invalid JWT shape.');
  }

  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
}

function requireEnv(name, value) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

function createAuthedClient(token) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    accessToken: async () => token,
  });
}

function asRows(data) {
  return Array.isArray(data) ? data : [];
}

function isBlocked(result) {
  return Boolean(result.error) || asRows(result.data).length === 0;
}

async function main() {
  requireEnv('NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL', supabaseUrl);
  requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY', supabaseAnonKey);
  requireEnv('RLS_TOKEN_USER_A', tokenA);
  requireEnv('RLS_TOKEN_USER_B', tokenB);

  const userAId = String(decodeJwtPayload(tokenA).sub || '');
  const userBId = String(decodeJwtPayload(tokenB).sub || '');

  if (!userAId || !userBId) {
    throw new Error('Failed to decode user ids from the provided JWTs.');
  }

  const clientA = createAuthedClient(tokenA);
  const clientB = createAuthedClient(tokenB);
  const now = new Date().toISOString();
  const report = [];

  const { data: projectData, error: projectError } = await clientA
    .from('projects')
    .insert({ user_id: userAId, name: `RLS Project ${Date.now()}`, color: 'gray', sort_order: Date.now() })
    .select('id')
    .single();

  if (projectError || !projectData) {
    throw new Error(`Failed to create test project for user A: ${projectError?.message ?? 'unknown error'}`);
  }

  const projectId = String(projectData.id);

  const { data: sectionData, error: sectionError } = await clientA
    .from('sections')
    .insert({ user_id: userAId, project_id: projectId, name: 'RLS Section', sort_order: Date.now() })
    .select('id')
    .single();

  if (sectionError || !sectionData) {
    throw new Error(`Failed to create test section for user A: ${sectionError?.message ?? 'unknown error'}`);
  }

  const sectionId = String(sectionData.id);

  const { data: taskData, error: taskError } = await clientA
    .from('tasks')
    .insert({
      user_id: userAId,
      project_id: projectId,
      section_id: sectionId,
      title: 'RLS Task',
      notes: 'Created by validation script.',
      is_completed: false,
      priority: 2,
      due_at: now,
      sort_order: Date.now(),
      source: 'manual',
    })
    .select('id')
    .single();

  if (taskError || !taskData) {
    throw new Error(`Failed to create test task for user A: ${taskError?.message ?? 'unknown error'}`);
  }

  const taskId = String(taskData.id);

  const { data: labelData, error: labelError } = await clientA
    .from('labels')
    .insert({ user_id: userAId, name: `rls-${Date.now()}`, color: 'gray' })
    .select('id')
    .single();

  if (labelError || !labelData) {
    throw new Error(`Failed to create test label for user A: ${labelError?.message ?? 'unknown error'}`);
  }

  const labelId = String(labelData.id);

  const { data: taskLabelData, error: taskLabelError } = await clientA
    .from('task_labels')
    .insert({ task_id: taskId, label_id: labelId, user_id: userAId })
    .select('task_id,label_id')
    .single();

  if (taskLabelError || !taskLabelData) {
    throw new Error(`Failed to create test task_label for user A: ${taskLabelError?.message ?? 'unknown error'}`);
  }

  const { data: reminderData, error: reminderError } = await clientA
    .from('reminders')
    .insert({ task_id: taskId, user_id: userAId, remind_at: now, channel: 'in_app', is_sent: false, sent_at: null })
    .select('id')
    .single();

  if (reminderError || !reminderData) {
    throw new Error(`Failed to create test reminder for user A: ${reminderError?.message ?? 'unknown error'}`);
  }

  const reminderId = String(reminderData.id);

  const { data: recurrenceData, error: recurrenceError } = await clientA
    .from('recurrences')
    .insert({ task_id: taskId, user_id: userAId, rule: 'weekly', timezone: 'UTC', next_due_at: now, preserve_time: true })
    .select('id')
    .single();

  if (recurrenceError || !recurrenceData) {
    throw new Error(`Failed to create test recurrence for user A: ${recurrenceError?.message ?? 'unknown error'}`);
  }

  const recurrenceId = String(recurrenceData.id);

  const checks = [
    {
      name: 'projects',
      select: () => clientB.from('projects').select('id').eq('id', projectId),
      update: () => clientB.from('projects').update({ name: 'blocked' }).eq('id', projectId).select('id'),
      remove: () => clientB.from('projects').delete().eq('id', projectId).select('id'),
    },
    {
      name: 'sections',
      select: () => clientB.from('sections').select('id').eq('id', sectionId),
      update: () => clientB.from('sections').update({ name: 'blocked' }).eq('id', sectionId).select('id'),
      remove: () => clientB.from('sections').delete().eq('id', sectionId).select('id'),
    },
    {
      name: 'tasks',
      select: () => clientB.from('tasks').select('id').eq('id', taskId),
      update: () => clientB.from('tasks').update({ title: 'blocked' }).eq('id', taskId).select('id'),
      remove: () => clientB.from('tasks').delete().eq('id', taskId).select('id'),
    },
    {
      name: 'task_labels',
      select: () => clientB.from('task_labels').select('task_id,label_id').eq('task_id', taskId).eq('label_id', labelId),
      update: () => clientB.from('task_labels').update({ user_id: userBId }).eq('task_id', taskId).eq('label_id', labelId).select('task_id'),
      remove: () => clientB.from('task_labels').delete().eq('task_id', taskId).eq('label_id', labelId).select('task_id'),
    },
    {
      name: 'reminders',
      select: () => clientB.from('reminders').select('id').eq('id', reminderId),
      update: () => clientB.from('reminders').update({ is_sent: true }).eq('id', reminderId).select('id'),
      remove: () => clientB.from('reminders').delete().eq('id', reminderId).select('id'),
    },
    {
      name: 'recurrences',
      select: () => clientB.from('recurrences').select('id').eq('id', recurrenceId),
      update: () => clientB.from('recurrences').update({ rule: 'daily' }).eq('id', recurrenceId).select('id'),
      remove: () => clientB.from('recurrences').delete().eq('id', recurrenceId).select('id'),
    },
  ];

  for (const check of checks) {
    const selectResult = await check.select();
    const updateResult = await check.update();
    const deleteResult = await check.remove();

    report.push({
      table: check.name,
      readBlocked: isBlocked(selectResult),
      updateBlocked: isBlocked(updateResult),
      deleteBlocked: isBlocked(deleteResult),
    });
  }

  await clientA.from('recurrences').delete().eq('id', recurrenceId);
  await clientA.from('reminders').delete().eq('id', reminderId);
  await clientA.from('task_labels').delete().eq('task_id', taskId).eq('label_id', labelId);
  await clientA.from('labels').delete().eq('id', labelId);
  await clientA.from('tasks').delete().eq('id', taskId);
  await clientA.from('sections').delete().eq('id', sectionId);
  await clientA.from('projects').delete().eq('id', projectId);

  console.table(report);

  const failures = report.filter((row) => !row.readBlocked || !row.updateBlocked || !row.deleteBlocked);
  if (failures.length > 0) {
    throw new Error(`RLS validation failed for ${failures.map((failure) => failure.table).join(', ')}`);
  }

  console.log('RLS validation passed for all checked tables.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
