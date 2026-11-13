import type { App } from '@slack/bolt';
import { CREATE_TASK_SHORTCUT_CALLBACK_ID } from '../lib/constants';
import { plainSlackText, toSingleLine } from '../lib/slackFormat';
import { buildAddTaskModal, type AddTaskMetadata } from '../views/addTaskModal';

export function registerCreateTaskShortcut(app: App): void {
  app.shortcut(CREATE_TASK_SHORTCUT_CALLBACK_ID, async ({ ack, shortcut, client }) => {
    await ack();

    if (shortcut.type !== 'message_action') return;

    const message = shortcut.message;
    const metadata: AddTaskMetadata = {
      channel_id: shortcut.channel.id,
      message_ts: message.ts,
      thread_ts: (message as { thread_ts?: string }).thread_ts ?? message.ts,
      requester: shortcut.user.id,
      source_author: message.user,
      message_text: (message.text ?? '').slice(0, 2500),
    };

    const suggestedTitle = toSingleLine(await plainSlackText(client, message.text ?? '')).slice(0, 150);

    await client.views.open({
      trigger_id: shortcut.trigger_id,
      view: buildAddTaskModal(metadata, { title: suggestedTitle }),
    });
  });
}
