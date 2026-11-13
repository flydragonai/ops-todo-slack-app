import type { App } from '@slack/bolt';
import type { View } from '@slack/types';
import { ACTION_IDS } from '../lib/constants';
import { refreshPinnedList } from '../services/pinnedListService';
import { createTask } from '../services/taskService';
import { buildTaskFormBlocks, parseTaskFormValues } from '../blocks/taskModalBlocks';
import { ticketCreatedText } from '../lib/hubLink';

export interface AddTaskMetadata {
  channel_id: string;
  message_ts?: string;
  thread_ts?: string;
  requester: string;
  source_author?: string;
  message_text?: string;
}

export function buildAddTaskModal(metadata: AddTaskMetadata, defaults: { title?: string } = {}): View {
  return {
    type: 'modal',
    callback_id: ACTION_IDS.ADD_TASK_MODAL_SUBMIT,
    private_metadata: JSON.stringify(metadata),
    title: { type: 'plain_text', text: 'Create Ticket' },
    submit: { type: 'plain_text', text: 'Create' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: buildTaskFormBlocks({ includeStatus: false, defaults }),
  };
}

export function registerAddTaskModalSubmit(app: App): void {
  app.view(ACTION_IDS.ADD_TASK_MODAL_SUBMIT, async ({ ack, view, body, client }) => {
    await ack();

    const meta = JSON.parse(view.private_metadata || '{}') as AddTaskMetadata;
    const values = parseTaskFormValues(view.state.values);

    let permalink: string | undefined;
    if (meta.channel_id && meta.thread_ts) {
      try {
        const res = await client.chat.getPermalink({
          channel: meta.channel_id,
          message_ts: meta.thread_ts,
        });
        permalink = res.permalink;
      } catch {
        // best effort — proceed without a permalink if this fails
      }
    }

    const { task, created } = await createTask(client, {
      title: values.title,
      description: meta.message_text,
      priority: values.priority,
      assignee_user_id: values.assignee_user_id ?? undefined,
      due_date: values.due_date ?? undefined,
      source_channel_id: meta.channel_id,
      source_message_ts: meta.message_ts,
      source_thread_ts: meta.thread_ts,
      source_permalink: permalink,
      source_author_user_id: meta.source_author,
      requester_user_id: body.user.id,
    });

    await refreshPinnedList(client);

    if (meta.channel_id && meta.message_ts) {
      try {
        await client.chat.postMessage({
          channel: meta.channel_id,
          thread_ts: meta.thread_ts ?? meta.message_ts,
          text: created ? ticketCreatedText(task) : `🎫 This message is already ticket #${task.number}.`,
        });
      } catch {
        // best effort — bot may not be a member of this channel
      }
    }
  });
}
