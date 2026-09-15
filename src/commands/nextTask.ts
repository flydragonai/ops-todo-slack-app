import type { App } from '@slack/bolt';
import type { KnownBlock } from '@slack/types';
import { ACTION_IDS, UNASSIGNED_LIST_LIMIT } from '../lib/constants';
import { buildTaskListBlocks, formatTaskLine } from '../blocks/taskListBlocks';
import {
  getActiveTasks,
  getAssignedOpenTasks,
  getTopOpenTask,
  getUnassignedOpenTasks,
  type Task,
} from '../services/taskService';

const NO_TASKS_MESSAGE = "🎉 No open tasks — you're all caught up.";

function buildSingleTaskBlocks(task: Task): KnownBlock[] {
  return [
    { type: 'section', text: { type: 'mrkdwn', text: `*Your next task:*\n${formatTaskLine(task)}` } },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Start' },
          action_id: ACTION_IDS.NEXT_TASK_START,
          value: task.id,
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Mark Done' },
          style: 'primary',
          action_id: ACTION_IDS.NEXT_TASK_DONE,
          value: task.id,
        },
      ],
    },
  ];
}

export function registerNextTask(app: App): void {
  app.command('/next-task', async ({ ack, respond, command }) => {
    await ack();

    const arg = command.text?.trim().toLowerCase();
    const tasks = await getActiveTasks();

    if (arg === 'any' || arg === 'team') {
      const top = getTopOpenTask(tasks);
      if (!top) {
        await respond({ response_type: 'ephemeral', text: NO_TASKS_MESSAGE });
        return;
      }
      await respond({ response_type: 'ephemeral', blocks: buildSingleTaskBlocks(top), text: top.title });
      return;
    }

    const mine = getAssignedOpenTasks(tasks, command.user_id);
    if (mine.length > 0) {
      await respond({ response_type: 'ephemeral', blocks: buildSingleTaskBlocks(mine[0]), text: mine[0].title });
      return;
    }

    const unassigned = getUnassignedOpenTasks(tasks);
    if (unassigned.length === 0) {
      await respond({ response_type: 'ephemeral', text: NO_TASKS_MESSAGE });
      return;
    }

    const shown = unassigned.slice(0, UNASSIGNED_LIST_LIMIT);
    const blocks = buildTaskListBlocks(shown, {
      headerText: "Nothing assigned to you — here's what's up for grabs",
    });
    if (unassigned.length > shown.length) {
      blocks.push({
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `_+${unassigned.length - shown.length} more — see /all-tasks or #ops-requests_` },
        ],
      });
    }

    await respond({ response_type: 'ephemeral', blocks, text: 'Unassigned tasks' });
  });
}
