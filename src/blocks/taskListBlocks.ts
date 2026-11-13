import type { KnownBlock } from '@slack/types';
import type { Task } from '../services/taskService';
import { ACTION_IDS, DONE_SECTION_LIMIT, PRIORITIES, PRIORITY_LABEL, STATUS_ICON, isActive } from '../lib/constants';
import { hubTicketUrl } from '../lib/hubLink';
import { escapeMrkdwn, toSingleLine } from '../lib/slackFormat';

export function formatTaskLine(task: Task): string {
  const icon = STATUS_ICON[task.status];
  const safeTitle = escapeMrkdwn(toSingleLine(task.title));
  const titleText = task.source_permalink
    ? `<${task.source_permalink}|${safeTitle}>`
    : `*${safeTitle}*`;
  const url = hubTicketUrl(task);
  const num = url ? `<${url}|#${task.number}>` : `#${task.number}`;
  const assignee = task.assignee_user_id ? `<@${task.assignee_user_id}>` : '_Unassigned_';
  const clientName = task.client_name ? ` · ${escapeMrkdwn(task.client_name)}` : '';
  const due = task.due_date ? ` · Due ${task.due_date}` : '';
  return `${icon} ${num} ${titleText}\n${assignee}${clientName}${due}`;
}

function taskSectionBlock(task: Task): KnownBlock {
  return {
    type: 'section',
    text: { type: 'mrkdwn', text: formatTaskLine(task) },
    accessory: {
      type: 'button',
      text: { type: 'plain_text', text: 'Edit', emoji: true },
      action_id: ACTION_IDS.EDIT_TASK,
      value: task.id,
    },
  };
}

export function buildTaskListBlocks(tasks: Task[], options: { headerText?: string } = {}): KnownBlock[] {
  const blocks: KnownBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: options.headerText ?? '🎫 Open Tickets', emoji: true },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `Updated ${new Date().toISOString()}` }],
    },
  ];

  const active = tasks.filter((t) => isActive(t.status));
  const done = tasks.filter((t) => t.status === 'resolved');

  if (active.length === 0) {
    blocks.push({ type: 'divider' });
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '_No open tickets 🎉_' } });
  }

  for (const priority of PRIORITIES) {
    const group = active.filter((t) => t.priority === priority);
    if (group.length === 0) continue;

    blocks.push({ type: 'divider' });
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*${PRIORITY_LABEL[priority]}*` } });
    for (const task of group) {
      blocks.push(taskSectionBlock(task));
    }
  }

  if (done.length > 0) {
    blocks.push({ type: 'divider' });
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*✅ Recently Resolved*' } });
    for (const task of done.slice(0, DONE_SECTION_LIMIT)) {
      blocks.push(taskSectionBlock(task));
    }
    if (done.length > DONE_SECTION_LIMIT) {
      blocks.push({
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `_+${done.length - DONE_SECTION_LIMIT} more resolved — see the CS Hub for full history_` },
        ],
      });
    }
  }

  return blocks;
}
