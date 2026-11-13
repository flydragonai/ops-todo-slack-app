// Tickets in the CS Hub tables (cs_tickets / cs_messages / cs_assignments).
// Kept the "task" names so the existing commands, blocks and modals stay small diffs.
import type { WebClient } from '@slack/web-api';
import { supabase } from './supabaseClient';
import { ensureStaff } from './staffService';
import { ACTIVE_STATUSES, DONE_SECTION_LIMIT, type Priority, type Status } from '../lib/constants';
import { plainSlackText, toSingleLine, userName } from '../lib/slackFormat';

export interface Task {
  id: string; // cs_tickets.ticket_id as a string (Slack action values are strings)
  number: number;
  title: string;
  client_name: string | null;
  source_permalink: string | null;
  assignee_user_id: string | null; // owner's Slack user id, when the owner is linked to Slack
  priority: Priority;
  status: Status;
  due_date: string | null;
  created_at: string;
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

const SELECT = 'ticket_id, title, slack_permalink, priority, status, due_date, created_at, owner:cs_staff!owner_staff_id(slack_user_id), client:clients(client_name)';

interface Row {
  ticket_id: number; title: string; slack_permalink: string | null; priority: Priority; status: Status
  due_date: string | null; created_at: string
  owner: { slack_user_id: string | null } | null; client: { client_name: string } | null
}

const toTask = (r: Row): Task => ({
  id: String(r.ticket_id), number: r.ticket_id, title: r.title, client_name: r.client?.client_name ?? null,
  source_permalink: r.slack_permalink, assignee_user_id: r.owner?.slack_user_id ?? null,
  priority: r.priority, status: r.status, due_date: r.due_date, created_at: r.created_at,
});

const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function compareDueDates(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1; // nulls last
  if (b === null) return -1;
  return new Date(a).getTime() - new Date(b).getTime();
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
    || compareDueDates(a.due_date, b.due_date)
    || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

/** Client referenced by a 6-digit client ID in the text (e.g. "100186"), plus its team. */
async function inferClient(text: string): Promise<{ client_id: number | null; team_id: number | null }> {
  const m = text.match(/\b(1\d{5})\b/);
  if (!m) return { client_id: null, team_id: null };
  const { data: c } = await supabase.from('clients').select('client_id, team_assignment').eq('client_id', Number(m[1])).maybeSingle();
  if (!c) return { client_id: null, team_id: null };
  const { data: t } = c.team_assignment
    ? await supabase.from('teams').select('team_id').eq('name', c.team_assignment).maybeSingle()
    : { data: null };
  return { client_id: c.client_id, team_id: t?.team_id ?? null };
}

/**
 * Creates a ticket (plus its first message). Returns created=false when this Slack
 * message already has a ticket — the shortcut and 🎫 reaction can both fire for one message.
 */
export async function createTask(client: WebClient, input: CreateTaskInput): Promise<{ task: Task; created: boolean }> {
  if (input.source_message_ts) {
    const existing = await getTaskBySlackMessage(input.source_channel_id, input.source_message_ts);
    if (existing) return { task: existing, created: false };
  }

  // Mentions/links → readable text (@Name, #channel), so the hub never shows raw <@U…> codes.
  const title = toSingleLine(await plainSlackText(client, input.title)).slice(0, 150);
  const body = (await plainSlackText(client, input.description?.trim() || input.title)).trim();
  const { client_id, team_id } = await inferClient(`${title} ${body}`);
  const ownerStaffId = input.assignee_user_id ? await ensureStaff(client, input.assignee_user_id) : null;

  const { data, error } = await supabase
    .from('cs_tickets')
    .insert({
      title,
      client_id,
      status: ownerStaffId ? 'open' : 'new',
      priority: input.priority ?? 'normal',
      priority_locked: !!input.priority && input.priority !== 'normal',
      category: 'account',
      source: 'slack',
      owner_team_id: team_id,
      owner_staff_id: ownerStaffId,
      due_date: input.due_date ?? null,
      tags: ['slack'],
      slack_channel_id: input.source_channel_id,
      slack_message_ts: input.source_message_ts ?? null,
      slack_thread_ts: input.source_thread_ts ?? null,
      slack_permalink: input.source_permalink ?? null,
      slack_requester_id: input.requester_user_id,
    })
    .select(SELECT)
    .single();
  if (error) {
    if (error.code === '23505' && input.source_message_ts) {
      const existing = await getTaskBySlackMessage(input.source_channel_id, input.source_message_ts);
      if (existing) return { task: existing, created: false };
    }
    throw error;
  }
  const task = toTask(data as unknown as Row);

  const author = input.source_author_user_id ?? input.requester_user_id;
  const { error: msgError } = await supabase.from('cs_messages').insert({
    ticket_id: task.number, direction: 'in', channel: 'slack', author: `@${await userName(client, author)}`, body,
    external_id: input.source_message_ts ?? null,
  });
  if (msgError && msgError.code !== '23505') throw msgError;

  if (ownerStaffId) {
    await supabase.from('cs_assignments').insert({
      ticket_id: task.number, to_staff_id: ownerStaffId, to_team_id: team_id, reason: 'manual',
      note: 'Assigned when created in Slack', created_by: await ensureStaff(client, input.requester_user_id),
    });
  }
  return { task, created: true };
}

/** Open tickets plus the most recently resolved few (for the "Recently done" section). */
export async function getActiveTasks(): Promise<Task[]> {
  const [open, done] = await Promise.all([
    supabase.from('cs_tickets').select(SELECT).in('status', ACTIVE_STATUSES),
    supabase.from('cs_tickets').select(SELECT).eq('status', 'resolved').order('updated_at', { ascending: false }).limit(DONE_SECTION_LIMIT + 1),
  ]);
  if (open.error) throw open.error;
  if (done.error) throw done.error;
  return [...sortTasks((open.data as unknown as Row[]).map(toTask)), ...(done.data as unknown as Row[]).map(toTask)];
}

export async function getTaskById(id: string): Promise<Task | null> {
  const { data, error } = await supabase.from('cs_tickets').select(SELECT).eq('ticket_id', Number(id)).maybeSingle();
  if (error) throw error;
  return data ? toTask(data as unknown as Row) : null;
}

async function getTaskBySlackMessage(channelId: string, messageTs: string): Promise<Task | null> {
  const { data, error } = await supabase.from('cs_tickets').select(SELECT)
    .eq('slack_channel_id', channelId).eq('slack_message_ts', messageTs).maybeSingle();
  if (error) throw error;
  return data ? toTask(data as unknown as Row) : null;
}

export async function updateTask(client: WebClient, id: string, updates: UpdateTaskInput, actorSlackId?: string): Promise<Task> {
  const ticketId = Number(id);
  const patch: Record<string, unknown> = {};
  if (updates.title !== undefined) patch.title = updates.title.slice(0, 200);
  if (updates.priority !== undefined) { patch.priority = updates.priority; patch.priority_locked = true }
  if (updates.due_date !== undefined) patch.due_date = updates.due_date;
  if (updates.status !== undefined) {
    patch.status = updates.status;
    patch.closed_at = updates.status === 'resolved' || updates.status === 'closed' ? new Date().toISOString() : null;
  }

  const actor = actorSlackId ? await ensureStaff(client, actorSlackId) : null;
  if (updates.assignee_user_id !== undefined) {
    const { data: cur } = await supabase.from('cs_tickets').select('owner_staff_id, owner_team_id').eq('ticket_id', ticketId).single();
    const to = updates.assignee_user_id ? await ensureStaff(client, updates.assignee_user_id) : null;
    if (cur && cur.owner_staff_id !== to) {
      patch.owner_staff_id = to;
      if (to) {
        await supabase.from('cs_assignments').insert({
          ticket_id: ticketId, from_staff_id: cur.owner_staff_id, to_staff_id: to, to_team_id: cur.owner_team_id,
          reason: 'manual', note: 'Reassigned in Slack', created_by: actor,
        });
      }
    }
  }

  const { data, error } = await supabase.from('cs_tickets').update(patch).eq('ticket_id', ticketId).select(SELECT).single();
  if (error) throw error;
  return toTask(data as unknown as Row);
}

/** "Delete" closes the ticket; history stays in the hub. */
export async function closeTask(client: WebClient, id: string, actorSlackId?: string): Promise<void> {
  await updateTask(client, id, { status: 'closed' }, actorSlackId);
}

export function getAssignedOpenTasks(tasks: Task[], userId: string): Task[] {
  return tasks.filter((t) => t.assignee_user_id === userId && ACTIVE_STATUSES.includes(t.status));
}

export function getUnassignedOpenTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.assignee_user_id && ACTIVE_STATUSES.includes(t.status));
}

export function getTopOpenTask(tasks: Task[]): Task | undefined {
  return tasks.find((t) => ACTIVE_STATUSES.includes(t.status));
}
