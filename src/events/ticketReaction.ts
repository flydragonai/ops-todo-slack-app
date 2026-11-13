import type { App } from '@slack/bolt';
import { TICKET_REACTION } from '../lib/constants';
import { toSingleLine } from '../lib/slackFormat';
import { refreshPinnedList } from '../services/pinnedListService';
import { createTask } from '../services/taskService';
import { ticketCreatedText } from '../lib/hubLink';

/**
 * 🎫 reaction on any message → ticket. Needs the reaction_added event plus reactions:read and
 * channels:history (groups:history for private channels). The bot must be in the channel.
 * Idempotent: one ticket per Slack message, so repeat reactions or Slack retries are no-ops.
 */
export function registerTicketReaction(app: App): void {
  app.event('reaction_added', async ({ event, client, logger }) => {
    if (event.reaction !== TICKET_REACTION || event.item.type !== 'message') return;
    const { channel, ts } = event.item;

    // Top-level messages come back from history; thread replies only from replies.
    let message: { text?: string; user?: string; thread_ts?: string; ts?: string } | undefined;
    const hist = await client.conversations.history({ channel, latest: ts, inclusive: true, limit: 1 });
    message = hist.messages?.find((m) => m.ts === ts);
    if (!message) {
      const rep = await client.conversations.replies({ channel, ts, limit: 1, inclusive: true, latest: ts });
      message = rep.messages?.find((m) => m.ts === ts);
    }
    if (!message?.text) {
      logger.warn(`ticket reaction: could not read message ${channel}/${ts}`);
      return;
    }

    let permalink: string | undefined;
    try { permalink = (await client.chat.getPermalink({ channel, message_ts: ts })).permalink } catch { /* best effort */ }

    const { task, created } = await createTask(client, {
      title: toSingleLine(message.text).slice(0, 150),
      description: message.text,
      source_channel_id: channel,
      source_message_ts: ts,
      source_thread_ts: message.thread_ts ?? ts,
      source_permalink: permalink,
      source_author_user_id: message.user,
      requester_user_id: event.user,
    });
    if (!created) return;

    await refreshPinnedList(client);
    try {
      await client.chat.postMessage({ channel, thread_ts: message.thread_ts ?? ts, text: ticketCreatedText(task) });
    } catch { /* best effort */ }
  });
}
