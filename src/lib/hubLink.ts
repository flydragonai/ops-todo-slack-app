import type { Task } from '../services/taskService';

/** Link to the ticket in the CS Hub when HUB_URL is set (e.g. https://hub.example.com). */
export function hubTicketUrl(task: Task): string | null {
  const base = process.env.HUB_URL?.replace(/\/$/, '');
  return base ? `${base}/#/ticket/${task.id}` : null;
}

export function ticketCreatedText(task: Task): string {
  const url = hubTicketUrl(task);
  const ref = url ? `<${url}|#${task.number}>` : `#${task.number}`;
  return `🎫 Ticket ${ref} created${task.client_name ? ` for ${task.client_name}` : ''} — tracked in <#${process.env.OPS_CHANNEL_ID}>.`;
}
