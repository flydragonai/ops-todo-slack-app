export const PRIORITIES = ['urgent', 'high', 'medium', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUSES = ['open', 'in_progress', 'done', 'archived'] as const;
export type Status = (typeof STATUSES)[number];

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: '🔴 Urgent',
  high: '🟠 High',
  medium: '🟡 Medium',
  low: '🟢 Low',
};

export const STATUS_ICON: Record<Status, string> = {
  open: '⬜',
  in_progress: '🔵',
  done: '✅',
  archived: '⬛',
};

export const ACTION_IDS = {
  EDIT_TASK: 'edit_task',
  ADD_TASK_MODAL_SUBMIT: 'add_task_modal_submit',
  EDIT_TASK_MODAL_SUBMIT: 'edit_task_modal_submit',
  NEXT_TASK_START: 'next_task_start',
  NEXT_TASK_DONE: 'next_task_done',
} as const;

export const CREATE_TASK_SHORTCUT_CALLBACK_ID = 'create_task_from_message';

export const PINNED_LIST_KEY = 'pinned_list';
export const DONE_SECTION_LIMIT = 5;
export const UNASSIGNED_LIST_LIMIT = 10;
