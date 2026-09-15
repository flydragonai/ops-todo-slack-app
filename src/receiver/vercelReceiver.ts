import type { App } from '@slack/bolt';
import type { Receiver, ReceiverEvent } from '@slack/bolt';
import { isValidSlackSignature } from './verifySignature';

function parseBody(rawBody: string, contentType: string | undefined): Record<string, unknown> {
  if (contentType?.includes('application/json')) {
    return JSON.parse(rawBody);
  }

  // application/x-www-form-urlencoded — slash commands, interactivity (block actions,
  // view submissions, shortcuts) all arrive this way, with interactivity payloads
  // nested as a JSON string under the `payload` field.
  const params = new URLSearchParams(rawBody);
  const payload = params.get('payload');
  if (payload) {
    return JSON.parse(payload);
  }
  return Object.fromEntries(params.entries());
}

/**
 * A custom Bolt Receiver for a Vercel Node function using the Web Standard
 * `fetch(request: Request): Promise<Response>` handler shape — Vercel's current
 * zero-config format for /api functions. Using the raw Request body directly (via
 * `request.text()`) sidesteps any ambiguity around Vercel's automatic body-parsing
 * helpers, which Slack's signature verification can't tolerate touching the body first.
 *
 * Follows the same shape as Bolt's official AwsLambdaReceiver: verify the raw body
 * against Slack's signature, build a ReceiverEvent, hand it to App.processEvent().
 */
export class VercelReceiver implements Receiver {
  private app?: App;

  init(app: App): void {
    this.app = app;
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}

  async handle(request: Request): Promise<Response> {
    if (!this.app) {
      throw new Error('VercelReceiver used before being initialized with a Bolt App');
    }

    const rawBody = await request.text();

    const signature = request.headers.get('x-slack-signature') ?? undefined;
    const timestamp = Number(request.headers.get('x-slack-request-timestamp'));
    const signingSecret = process.env.SLACK_SIGNING_SECRET;

    if (!signingSecret || !isValidSlackSignature(signingSecret, rawBody, signature, timestamp)) {
      return new Response('Invalid signature', { status: 401 });
    }

    const body = parseBody(rawBody, request.headers.get('content-type') ?? undefined);

    // legacy SSL check used by Slack when validating a slash command's Request URL
    if (typeof body.ssl_check !== 'undefined') {
      return new Response('', { status: 200 });
    }

    // Events API URL verification handshake (unused today, harmless to keep for future-proofing)
    if (body.type === 'url_verification') {
      return Response.json({ challenge: body.challenge });
    }

    let storedResponse: unknown;
    let acknowledged = false;

    const retryNumHeader = request.headers.get('x-slack-retry-num');
    const event: ReceiverEvent = {
      body,
      ack: async (response) => {
        acknowledged = true;
        storedResponse = response ?? '';
      },
      retryNum: retryNumHeader ? Number(retryNumHeader) : undefined,
      retryReason: request.headers.get('x-slack-retry-reason') ?? undefined,
    };

    try {
      await this.app.processEvent(event);
    } catch (err) {
      console.error('Unhandled error while processing Slack event', err);
      return new Response('Internal server error', { status: 500 });
    }

    if (!acknowledged) {
      return new Response('', { status: 404 });
    }

    if (typeof storedResponse === 'string') {
      return new Response(storedResponse, { status: 200 });
    }
    return Response.json(storedResponse);
  }
}
