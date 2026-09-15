import { supabase } from './supabaseClient';
import type { Priority, Status } from '../lib/constants';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  source_channel_id: string;
  source_message_ts: string | null;
  source_thread_ts: string | null;
  source_permalink: string | null;
  source_author_user_id: string | null;
  requester_user_id: string;
  created_via: 'slash_command' | 'message_shortcut' | 'manual';
  assignee_user_id: string | null;
  priority: Priority;
  status: Status;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  source_channel_id: string;
  source_message_ts?: string;
  source_thread_ts?: string;
  source_permalink?: string;
  source_author_user_id?: string;
  requester_user_id: string;
  created_via: Task['created_via'];
  assignee_user_id?: string;
  priority?: Priority;
  due_date?: string;
}

export interface UpdateTaskInput {
  title?: string;
  priority?: Priority;
  status?: Status;
  assignee_user_id?: string | null;
  due_date?: string | null;
}

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const STATUS_RANK: Record<Status, number> = { open: 0, in_progress: 0, done: 1, archived: 2 };

function compareDueDates(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1; // nulls last
  if (b === null) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const statusDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (statusDiff !== 0) return statusDiff;
    const priorityDiff = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    const dueDiff = compareDueDates(a.due_date, b.due_date);
    if (dueDiff !== 0) return dueDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const { data, error } = await supabase
    .from('ops_tasks')
    .insert({
      title: input.title,
      description: input.description ?? null,
      source_channel_id: input.source_channel_id,
      source_message_ts: input.source_message_ts ?? null,
      source_thread_ts: input.source_thread_ts ?? null,
      source_permalink: input.source_permalink ?? null,
      source_author_user_id: input.source_author_user_id ?? null,
      requester_user_id: input.requester_user_id,
      created_via: input.created_via,
      assignee_user_id: input.assignee_user_id ?? null,
      priority: input.priority ?? 'medium',
      due_date: input.due_date ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Task;
}

export async function getActiveTasks(): Promise<Task[]> {
  const { data, error } = await supabase.from('ops_tasks').select('*').neq('status', 'archived');
  if (error) throw error;
  return sortTasks((data ?? []) as Task[]);
}

export async function getTaskById(id: string): Promise<Task | null> {
  const { data, error } = await supabase.from('ops_tasks').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Task | null) ?? null;
}

export async function updateTask(id: string, updates: UpdateTaskInput): Promise<Task> {
  const patch: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
  if (updates.status === 'done') {
    patch.completed_at = new Date().toISOString();
  } else if (updates.status) {
    patch.completed_at = null;
  }

  const { data, error } = await supabase.from('ops_tasks').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as Task;
}

export function getAssignedOpenTasks(tasks: Task[], userId: string): Task[] {
  return tasks.filter(
    (t) => t.assignee_user_id === userId && (t.status === 'open' || t.status === 'in_progress'),
  );
}

export function getUnassignedOpenTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.assignee_user_id && (t.status === 'open' || t.status === 'in_progress'));
}

export function getTopOpenTask(tasks: Task[]): Task | undefined {
  return tasks.find((t) => t.status === 'open' || t.status === 'in_progress');
}
