// Vocabulary matches the CS Hub (cs_tickets) so Slack and the hub agree.
export const PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const;
export type Priority = (typeof PRIORITIES)[number];

export const STATUSES = ['new', 'open', 'waiting_customer', 'waiting_internal', 'resolved', 'closed'] as const;
export type Status = (typeof STATUSES)[number];

export const ACTIVE_STATUSES: Status[] = ['new', 'open', 'waiting_customer', 'waiting_internal'];
export const isActive = (s: Status) => ACTIVE_STATUSES.includes(s);

export const PRIORITY_LABEL: Record<Priority, string> = {
  urgent: '🔴 Urgent',
  high: '🟠 High',
  normal: '🟡 Normal',
  low: '🟢 Low',
};

export const STATUS_ICON: Record<Status, string> = {
  new: '🆕',
  open: '🔵',
  waiting_customer: '⏳',
  waiting_internal: '🧱',
  resolved: '✅',
  closed: '🗑️',
};

export const STATUS_LABEL: Record<Status, string> = {
  new: 'New',
  open: 'Open',
  waiting_customer: 'Waiting on customer',
  waiting_internal: 'Waiting on internal',
  resolved: 'Resolved',
  closed: 'Closed',
};

export const ACTION_IDS = {
  EDIT_TASK: 'edit_task',
  ADD_TASK_MODAL_SUBMIT: 'add_task_modal_submit',
  EDIT_TASK_MODAL_SUBMIT: 'edit_task_modal_submit',
  DELETE_TASK_BUTTON: 'delete_task_button',
  NEXT_TASK_START: 'next_task_start',
  NEXT_TASK_DONE: 'next_task_done',
} as const;

export const CREATE_TASK_SHORTCUT_CALLBACK_ID = 'create_task_from_message';
/** Reacting to a message with this emoji (:ticket:) creates a ticket. */
export const TICKET_REACTION = 'ticket';

export const PINNED_LIST_KEY = 'pinned_list';
export const DONE_SECTION_LIMIT = 5;
export const UNASSIGNED_LIST_LIMIT = 10;
