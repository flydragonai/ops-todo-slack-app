import type { App } from '@slack/bolt';
import { escapeMrkdwn, toSingleLine } from '../lib/slackFormat';
import { refreshPinnedList } from '../services/pinnedListService';
import { createTask } from '../services/taskService';

export function registerAddTask(app: App): void {
  app.command('/add-task', async ({ ack, respond, command, client }) => {
    await ack();

    const title = toSingleLine(command.text ?? '');
    if (!title) {
      await respond({ response_type: 'ephemeral', text: 'Usage: `/add-task <description>`' });
      return;
    }

    const { task } = await createTask(client, {
      title,
      source_channel_id: command.channel_id,
      requester_user_id: command.user_id,
    });

    await refreshPinnedList(client);

    await respond({
      response_type: 'ephemeral',
      text: `🎫 Ticket #${task.number} added: *${escapeMrkdwn(title)}* — see the full list in <#${process.env.OPS_CHANNEL_ID}>`,
    });
  });
}
