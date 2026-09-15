import type { App } from '@slack/bolt';
import type { View } from '@slack/types';
import { ACTION_IDS } from '../lib/constants';
import { refreshPinnedList } from '../services/pinnedListService';
import { updateTask, type Task } from '../services/taskService';
import { buildTaskFormBlocks, parseTaskFormValues } from '../blocks/taskModalBlocks';

interface EditTaskMetadata {
  taskId: string;
}

export function buildEditTaskModal(task: Task): View {
  return {
    type: 'modal',
    callback_id: ACTION_IDS.EDIT_TASK_MODAL_SUBMIT,
    private_metadata: JSON.stringify({ taskId: task.id } satisfies EditTaskMetadata),
    title: { type: 'plain_text', text: 'Edit Task' },
    submit: { type: 'plain_text', text: 'Save' },
    close: { type: 'plain_text', text: 'Cancel' },
    blocks: buildTaskFormBlocks({
      includeStatus: true,
      defaults: {
        title: task.title,
        priority: task.priority,
        status: task.status,
        assignee: task.assignee_user_id ?? undefined,
        dueDate: task.due_date ?? undefined,
      },
    }),
  };
}

export function registerEditTaskModalSubmit(app: App): void {
  app.view(ACTION_IDS.EDIT_TASK_MODAL_SUBMIT, async ({ ack, view, client }) => {
    await ack();

    const meta = JSON.parse(view.private_metadata || '{}') as EditTaskMetadata;
    const values = parseTaskFormValues(view.state.values);

    await updateTask(meta.taskId, {
      title: values.title,
      priority: values.priority,
      status: values.status,
      assignee_user_id: values.assignee_user_id,
      due_date: values.due_date,
    });

    await refreshPinnedList(client);
  });
}
