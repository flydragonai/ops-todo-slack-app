import { randomBytes } from 'node:crypto';
import { saveUserToken } from '../src/services/userTokens';

// "Connect your Slack": a person authorizes the app's user scopes so their 🎫 reactions are
// picked up anywhere they can see the message (not only in channels the bot is in).
//   Start:    https://<app>.vercel.app/api/slack-oauth
//   Callback: same URL with ?code=&state= (must be listed under redirect_urls in the manifest)
// Needs SLACK_CLIENT_ID and SLACK_CLIENT_SECRET (Slack app → Basic Information).

const USER_SCOPES = ['reactions:read', 'channels:history', 'groups:history', 'im:history', 'mpim:history', 'chat:write'];

const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
      `<body style="font:16px system-ui;max-width:32rem;margin:15vh auto;padding:0 1rem;color:#1c1917"><h1 style="font-size:1.4rem">${title}</h1>${body}</body>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const redirectUri = `${url.origin}${url.pathname}`;
    const clientId = process.env.SLACK_CLIENT_ID;
    const clientSecret = process.env.SLACK_CLIENT_SECRET;
    if (!clientId || !clientSecret) return page('Not configured', '<p>SLACK_CLIENT_ID / SLACK_CLIENT_SECRET are not set.</p>', 500);

    const code = url.searchParams.get('code');
    if (url.searchParams.get('error')) return page('Not connected', '<p>You cancelled the Slack authorization. Nothing was changed.</p>');

    // Step 1: send the person to Slack, with a state value checked on the way back (CSRF).
    if (!code) {
      const state = randomBytes(16).toString('hex');
      const auth = new URL('https://slack.com/oauth/v2/authorize');
      auth.searchParams.set('client_id', clientId);
      auth.searchParams.set('user_scope', USER_SCOPES.join(','));
      auth.searchParams.set('redirect_uri', redirectUri);
      auth.searchParams.set('state', state);
      return new Response(null, {
        status: 302,
        headers: { Location: auth.toString(), 'Set-Cookie': `slack_oauth_state=${state}; Path=/api/slack-oauth; HttpOnly; Secure; SameSite=Lax; Max-Age=600` },
      });
    }

    // Step 2: Slack sent them back — verify state, exchange the code for their user token.
    const cookieState = /(?:^|;\s*)slack_oauth_state=([a-f0-9]+)/.exec(request.headers.get('cookie') ?? '')?.[1];
    if (!cookieState || cookieState !== url.searchParams.get('state')) {
      return page('Link expired', `<p>Please <a href="${redirectUri}">start again</a>.</p>`, 400);
    }
    const res = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
    });
    const json = (await res.json()) as { ok: boolean; error?: string; authed_user?: { id: string; access_token?: string; scope?: string } };
    const user = json.authed_user;
    if (!json.ok || !user?.access_token) return page('Not connected', `<p>Slack said: ${json.error ?? 'no user token returned'}.</p>`, 400);

    await saveUserToken(user.id, user.access_token, user.scope ?? '');
    return new Response(page('Connected ✅', '<p>Your 🎫 (<code>:ticket:</code>) reactions now create CS Hub tickets anywhere you can see the message. You can close this tab.</p>').body, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Set-Cookie': 'slack_oauth_state=; Path=/api/slack-oauth; Max-Age=0' },
    });
  },
};
