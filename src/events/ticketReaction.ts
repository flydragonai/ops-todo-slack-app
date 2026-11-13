import type { App } from '@slack/bolt';
import { WebClient } from '@slack/web-api';
import { TICKET_REACTION } from '../lib/constants';
import { refreshPinnedList } from '../services/pinnedListService';
import { createTask } from '../services/taskService';
import { ticketCreatedText } from '../lib/hubLink';
import { userClients } from '../services/userTokens';

type Msg = { text?: string; user?: string; thread_ts?: string; ts?: string };

/** Errors meaning "the bot can't see this conversation" — fall back to connected people's tokens. */
const CANT_SEE = ['not_in_channel', 'channel_not_found', 'missing_scope'];

/** Finds one message by ts, whether it's top-level or a reply inside a thread. */
async function readMessage(c: WebClient, channel: string, ts: string): Promise<Msg | undefined> {
  const hist = await c.conversations.history({ channel, latest: ts, oldest: ts, inclusive: true, limit: 1 });
  const top = hist.messages?.find((m) => m.ts === ts);
  if (top) return top;
  // A thread reply: replies() always returns the parent first, then replies within [oldest, latest].
  const rep = await c.conversations.replies({ channel, ts, latest: ts, oldest: ts, inclusive: true, limit: 2 });
  return rep.messages?.find((m) => m.ts === ts);
}

/**
 * 🎫 (:ticket:) reaction on any message → ticket.
 * - Bot event: fires in channels the bot is in.
 * - User event (reaction_added under user_events): fires anywhere the authorizing user can see,
 *   including private channels and DMs; the message is then read with SLACK_USER_TOKEN.
 * Idempotent: one ticket per Slack message, so duplicate events (bot + user), repeat reactions
 * and Slack retries are no-ops.
 */
export function registerTicketReaction(app: App): void {
  app.event('reaction_added', async ({ event, client, logger }) => {
    if (event.reaction !== TICKET_REACTION || event.item.type !== 'message') return;
    const { channel, ts } = event.item;

    let message: Msg | undefined;
    let reader: WebClient = client;
    try {
      message = await readMessage(client, channel, ts);
    } catch (err) {
      const code = (err as { data?: { error?: string } }).data?.error;
      if (!CANT_SEE.includes(code ?? '')) throw err;
    }
    // The bot can't see it: try each connected person's token, the reactor's first.
    if (!message) {
      for (const uc of await userClients(event.user)) {
        try {
          message = await readMessage(uc, channel, ts);
        } catch (err) {
          logger.debug(`ticket reaction: user token can't read ${channel}: ${(err as { data?: { error?: string } }).data?.error ?? err}`);
        }
        if (message) { reader = uc; break; }
      }
    }
    if (!message?.text) {
      logger.warn(`ticket reaction: could not read message ${channel}/${ts}`);
      return;
    }

    let permalink: string | undefined;
    try { permalink = (await reader.chat.getPermalink({ channel, message_ts: ts })).permalink } catch { /* best effort */ }

    const { task, created } = await createTask(client, {
      title: message.text,
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
    // Confirm in the thread when the bot can post there (member, or public channel via
    // chat:write.public); otherwise DM the person who reacted.
    try {
      await client.chat.postMessage({ channel, thread_ts: message.thread_ts ?? ts, text: ticketCreatedText(task) });
    } catch {
      try {
        const dm = await client.conversations.open({ users: event.user });
        if (dm.channel?.id) {
          await client.chat.postMessage({ channel: dm.channel.id, text: `${ticketCreatedText(task)}${permalink ? `\nFrom: ${permalink}` : ''}` });
        }
      } catch { /* best effort */ }
    }
  });
}
