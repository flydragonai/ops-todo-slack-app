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

    await createTask({
      title,
      source_channel_id: command.channel_id,
      requester_user_id: command.user_id,
      created_via: 'slash_command',
    });

    await refreshPinnedList(client);

    await respond({
      response_type: 'ephemeral',
      text: `✅ Task added: *${escapeMrkdwn(title)}* — see the full list in <#${process.env.OPS_CHANNEL_ID}>`,
    });
  });
}
