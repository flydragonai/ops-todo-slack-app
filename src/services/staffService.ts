import type { WebClient } from '@slack/web-api';
import { supabase } from './supabaseClient';

/**
 * Returns the cs_staff id for a Slack user, creating the staff row on first sight
 * (name + email from users.info). Needs the users:read and users:read.email scopes.
 */
export async function ensureStaff(client: WebClient, slackUserId: string): Promise<number> {
  const { data: existing, error } = await supabase
    .from('cs_staff')
    .select('staff_id')
    .eq('slack_user_id', slackUserId)
    .maybeSingle();
  if (error) throw error;
  if (existing) return existing.staff_id as number;

  const info = await client.users.info({ user: slackUserId });
  const profile = info.user?.profile;
  const name = profile?.real_name || info.user?.real_name || info.user?.name || slackUserId;
  // Fallback keeps the NOT NULL/UNIQUE email constraint satisfied if the email scope is missing.
  const email = (profile?.email ?? `${slackUserId}@slack.invalid`).toLowerCase();

  // A hub user may already exist by email (added before they used Slack) — link it.
  const { data: byEmail } = await supabase.from('cs_staff').select('staff_id').eq('email', email).maybeSingle();
  if (byEmail) {
    await supabase.from('cs_staff').update({ slack_user_id: slackUserId }).eq('staff_id', byEmail.staff_id);
    return byEmail.staff_id as number;
  }

  const { data: created, error: insertError } = await supabase
    .from('cs_staff')
    .insert({ name, email, slack_user_id: slackUserId })
    .select('staff_id')
    .single();
  if (insertError) {
    // Lost a race with a concurrent request for the same user — read the winner.
    if (insertError.code === '23505') {
      const { data } = await supabase.from('cs_staff').select('staff_id').eq('slack_user_id', slackUserId).single();
      return data!.staff_id as number;
    }
    throw insertError;
  }
  return created.staff_id as number;
}
