import type { App, BlockButtonAction } from '@slack/bolt';
import { ACTION_IDS } from '../lib/constants';
import { refreshPinnedList } from '../services/pinnedListService';
import { updateTask } from '../services/taskService';

export function registerNextTaskQuickActions(app: App): void {
  app.action<BlockButtonAction>(ACTION_IDS.NEXT_TASK_START, async ({ ack, body, client, respond }) => {
    await ack();
    const taskId = body.actions[0]?.value;
    if (!taskId) return;

    await updateTask(client, taskId, { status: 'open' }, body.user.id);
    await refreshPinnedList(client);
    await respond({
      replace_original: true,
      text: '▶️ Marked open. Run `/next-task` again for your next one.',
    });
  });

  app.action<BlockButtonAction>(ACTION_IDS.NEXT_TASK_DONE, async ({ ack, body, client, respond }) => {
    await ack();
    const taskId = body.actions[0]?.value;
    if (!taskId) return;

    await updateTask(client, taskId, { status: 'resolved' }, body.user.id);
    await refreshPinnedList(client);
    await respond({
      replace_original: true,
      text: '✅ Resolved — nice work! Run `/next-task` again for your next one.',
    });
  });
}
