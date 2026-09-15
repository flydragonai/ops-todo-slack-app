import type { App } from '@slack/bolt';
import { buildTaskListBlocks } from '../blocks/taskListBlocks';
import { getActiveTasks } from '../services/taskService';

export function registerAllTasks(app: App): void {
  app.command('/all-tasks', async ({ ack, respond }) => {
    await ack();

    const tasks = await getActiveTasks();
    const blocks = buildTaskListBlocks(tasks, { headerText: '📋 All Tasks' });

    await respond({ response_type: 'ephemeral', blocks, text: 'All tasks' });
  });
}
