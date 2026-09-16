import type { KnownBlock } from '@slack/types';
import type { Task } from '../services/taskService';
import { ACTION_IDS, DONE_SECTION_LIMIT, PRIORITIES, PRIORITY_LABEL, STATUS_ICON } from '../lib/constants';
import { escapeMrkdwn } from '../lib/slackFormat';

export function formatTaskLine(task: Task): string {
  const icon = STATUS_ICON[task.status];
  const safeTitle = escapeMrkdwn(task.title);
  const titleText = task.source_permalink
    ? `<${task.source_permalink}|${safeTitle}>`
    : `*${safeTitle}*`;
  const assignee = task.assignee_user_id ? `<@${task.assignee_user_id}>` : '_Unassigned_';
  const due = task.due_date ? ` · Due ${task.due_date}` : '';
  return `${icon} ${titleText}\n${assignee}${due}`;
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
      text: { type: 'plain_text', text: options.headerText ?? '📋 Ops Task List', emoji: true },
    },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: `Updated ${new Date().toISOString()}` }],
    },
  ];

  const active = tasks.filter((t) => t.status === 'open' || t.status === 'in_progress');
  const done = tasks.filter((t) => t.status === 'done');

  if (active.length === 0) {
    blocks.push({ type: 'divider' });
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '_No open tasks 🎉_' } });
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
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: '*✅ Recently Done*' } });
    for (const task of done.slice(0, DONE_SECTION_LIMIT)) {
      blocks.push(taskSectionBlock(task));
    }
    if (done.length > DONE_SECTION_LIMIT) {
      blocks.push({
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `_+${done.length - DONE_SECTION_LIMIT} more done — see Supabase for full history_` },
        ],
      });
    }
  }

  return blocks;
}
