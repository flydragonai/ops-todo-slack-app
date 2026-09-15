import type { WebClient } from '@slack/web-api';
import { buildTaskListBlocks } from '../blocks/taskListBlocks';
import { PINNED_LIST_KEY } from '../lib/constants';
import { getActiveTasks } from './taskService';
import { supabase } from './supabaseClient';

function getOpsChannelId(): string {
  const channelId = process.env.OPS_CHANNEL_ID;
  if (!channelId) throw new Error('Missing OPS_CHANNEL_ID env var');
  return channelId;
}

export async function refreshPinnedList(client: WebClient): Promise<void> {
  const opsChannelId = getOpsChannelId();
  const tasks = await getActiveTasks();
  const blocks = buildTaskListBlocks(tasks);

  const { data: state } = await supabase
    .from('ops_app_state')
    .select('*')
    .eq('key', PINNED_LIST_KEY)
    .maybeSingle();

  if (state?.message_ts) {
    try {
      await client.chat.update({
        channel: opsChannelId,
        ts: state.message_ts,
        blocks,
        text: 'Ops Task List',
      });
      return;
    } catch (err) {
      const slackError = (err as { data?: { error?: string } }).data?.error;
      if (slackError !== 'message_not_found') throw err;
      // pinned message was deleted out from under us — fall through and recreate it
    }
  }

  const posted = await client.chat.postMessage({
    channel: opsChannelId,
    blocks,
    text: 'Ops Task List',
  });

  if (posted.ts) {
    await client.pins.add({ channel: opsChannelId, timestamp: posted.ts });
    await supabase.from('ops_app_state').upsert({
      key: PINNED_LIST_KEY,
      channel_id: opsChannelId,
      message_ts: posted.ts,
      updated_at: new Date().toISOString(),
    });
  }
}
