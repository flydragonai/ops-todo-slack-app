import type { InputBlock } from '@slack/types';
import type { Priority, Status } from '../lib/constants';
import { PRIORITIES, PRIORITY_LABEL, STATUS_ICON, STATUS_LABEL, STATUSES } from '../lib/constants';

export interface TaskFormDefaults {
  title?: string;
  priority?: Priority;
  status?: Status;
  assignee?: string;
  dueDate?: string;
}

export function buildTaskFormBlocks(options: {
  includeStatus: boolean;
  defaults?: TaskFormDefaults;
}): InputBlock[] {
  const { includeStatus, defaults = {} } = options;
  const priority = defaults.priority ?? 'medium';
  const status = defaults.status ?? 'open';

  const blocks: InputBlock[] = [
    {
      type: 'input',
      block_id: 'title_block',
      label: { type: 'plain_text', text: 'Title' },
      element: {
        type: 'plain_text_input',
        action_id: 'title_input',
        initial_value: defaults.title ?? '',
      },
    },
    {
      type: 'input',
      block_id: 'priority_block',
      label: { type: 'plain_text', text: 'Priority' },
      element: {
        type: 'static_select',
        action_id: 'priority_input',
        initial_option: {
          text: { type: 'plain_text', text: PRIORITY_LABEL[priority] },
          value: priority,
        },
        options: PRIORITIES.map((p) => ({
          text: { type: 'plain_text', text: PRIORITY_LABEL[p] },
          value: p,
        })),
      },
    },
  ];

  if (includeStatus) {
    blocks.push({
      type: 'input',
      block_id: 'status_block',
      label: { type: 'plain_text', text: 'Status' },
      element: {
        type: 'static_select',
        action_id: 'status_input',
        initial_option: {
          text: { type: 'plain_text', text: `${STATUS_ICON[status]} ${STATUS_LABEL[status]}` },
          value: status,
        },
        options: STATUSES.map((s) => ({
          text: { type: 'plain_text', text: `${STATUS_ICON[s]} ${STATUS_LABEL[s]}` },
          value: s,
        })),
      },
    });
  }

  blocks.push({
    type: 'input',
    block_id: 'assignee_block',
    optional: true,
    label: { type: 'plain_text', text: 'Assignee' },
    element: {
      type: 'users_select',
      action_id: 'assignee_input',
      ...(defaults.assignee ? { initial_user: defaults.assignee } : {}),
    },
  });

  blocks.push({
    type: 'input',
    block_id: 'due_date_block',
    optional: true,
    label: { type: 'plain_text', text: 'Due date' },
    element: {
      type: 'datepicker',
      action_id: 'due_date_input',
      ...(defaults.dueDate ? { initial_date: defaults.dueDate } : {}),
    },
  });

  return blocks;
}

export interface ParsedTaskForm {
  title: string;
  priority: Priority;
  status?: Status;
  assignee_user_id: string | null;
  due_date: string | null;
}

export function parseTaskFormValues(values: Record<string, Record<string, any>>): ParsedTaskForm {
  return {
    title: values.title_block.title_input.value as string,
    priority: values.priority_block.priority_input.selected_option.value as Priority,
    status: values.status_block?.status_input?.selected_option?.value as Status | undefined,
    assignee_user_id: (values.assignee_block?.assignee_input?.selected_user as string | undefined) ?? null,
    due_date: (values.due_date_block?.due_date_input?.selected_date as string | undefined) ?? null,
  };
}
