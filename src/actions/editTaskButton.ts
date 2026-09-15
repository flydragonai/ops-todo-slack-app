import type { App, BlockButtonAction } from '@slack/bolt';
import { ACTION_IDS } from '../lib/constants';
import { getTaskById } from '../services/taskService';
import { buildEditTaskModal } from '../views/editTaskModal';

export function registerEditTaskButton(app: App): void {
  app.action<BlockButtonAction>(ACTION_IDS.EDIT_TASK, async ({ ack, body, client }) => {
    await ack();

    const taskId = body.actions[0]?.value;
    if (!taskId) return;

    const task = await getTaskById(taskId);
    if (!task) return;

    await client.views.open({
      trigger_id: body.trigger_id,
      view: buildEditTaskModal(task),
    });
  });
}
