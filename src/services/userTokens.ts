import { WebClient } from '@slack/web-api';
import { supabase } from './supabaseClient';

// Per-person Slack user tokens, from the "Connect your Slack" flow (api/slack-oauth.ts).
// Stored server-side in cs_settings (service role only; RLS on, no browser access) as
// key `slack_user_token:<slack user id>`.
const PREFIX = 'slack_user_token:';

export async function saveUserToken(slackUserId: string, token: string, scope: string): Promise<void> {
  const { error } = await supabase.from('cs_settings').upsert({
    key: `${PREFIX}${slackUserId}`,
    value: { token, scope, connected_at: new Date().toISOString() },
  });
  if (error) throw error;
}

/** Clients for every connected person, the reactor's first. Includes SLACK_USER_TOKEN if set. */
export async function userClients(preferUserId?: string): Promise<WebClient[]> {
  const { data, error } = await supabase.from('cs_settings').select('key, value').like('key', `${PREFIX}%`);
  if (error) throw error;
  const rows = (data ?? []) as { key: string; value: { token: string } }[];
  rows.sort((a, b) => Number(b.key === `${PREFIX}${preferUserId}`) - Number(a.key === `${PREFIX}${preferUserId}`));
  const tokens = rows.map((r) => r.value.token);
  if (process.env.SLACK_USER_TOKEN && !tokens.includes(process.env.SLACK_USER_TOKEN)) tokens.push(process.env.SLACK_USER_TOKEN);
  return tokens.map((t) => new WebClient(t));
}
