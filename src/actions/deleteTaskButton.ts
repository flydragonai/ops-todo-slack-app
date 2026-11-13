import type { App, BlockButtonAction } from '@slack/bolt';
import { ACTION_IDS } from '../lib/constants';
import { refreshPinnedList } from '../services/pinnedListService';
import { closeTask } from '../services/taskService';

export function registerDeleteTaskButton(app: App): void {
  app.action<BlockButtonAction>(ACTION_IDS.DELETE_TASK_BUTTON, async ({ ack, body, client }) => {
    await ack();

    const taskId = body.actions[0]?.value;
    if (!taskId) return;

    await closeTask(client, taskId, body.user.id);
    await refreshPinnedList(client);

    if (body.view) {
      await client.views.update({
        view_id: body.view.id,
        hash: body.view.hash,
        view: {
          type: 'modal',
          title: { type: 'plain_text', text: 'Ticket Closed' },
          close: { type: 'plain_text', text: 'Close' },
          blocks: [
            { type: 'section', text: { type: 'mrkdwn', text: '🗑️ Ticket closed. Its history is still in the CS Hub.' } },
          ],
        },
      });
    }
  });
}
