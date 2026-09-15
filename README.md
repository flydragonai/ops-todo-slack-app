# Ops Task List — Slack App

A native to-do list for the team, built as a Slack app.

Built by [Fly Dragon](https://www.goflydragon.com/).

- `/add-task <description>` — add a task from any channel (typed into the main compose box; Slack does not allow slash commands inside a thread reply box).
- **"Create task from this message"** — a message shortcut (on the `···` menu of any message, including thread replies) that opens a modal to create a task linked to that exact thread/message.
- `/next-task` — your top-priority assigned task, or if you have none, a list of unassigned tasks up for grabs. `/next-task any` shows the single top-priority task workspace-wide.
- `/all-tasks` — the full sorted task list, delivered privately wherever you type it.
- A pinned, always-current message in **#ops-requests** shows the full list grouped by priority, with an "Edit" button per task (priority, status, assignee, due date) that anyone on the team can use.

## Setup

### 1. Supabase

Create a project, then run [`db/schema.sql`](db/schema.sql) in the SQL editor. Grab the project URL and **service role key** (Settings → API) — never expose the service role key to a browser client.

### 2. Slack app

Deploy to Vercel first (step 3) so you know your app's URL, then:

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From an app manifest**.
2. Pick your workspace, paste in [`slack-manifest.json`](slack-manifest.json), but first replace every `https://REPLACE_WITH_YOUR_DEPLOYMENT.vercel.app/api/slack` with your real deployed URL.
3. Create the app, then **Install to Workspace**.
4. Copy from the app's settings:
   - **OAuth & Permissions** → Bot User OAuth Token (`SLACK_BOT_TOKEN`, starts `xoxb-`)
   - **Basic Information** → Signing Secret (`SLACK_SIGNING_SECRET`)
5. Invite the bot to `#ops-requests` (`/invite @ops-task-list`) — required for it to pin the live list there.

### 3. Deploy

First pass — deploy with no env vars set yet, just to learn your URL (the app builds fine either way; it only reads env vars once a real request comes in):

```bash
npm install -g vercel   # if you don't have it
vercel link
vercel deploy --prod
```

Note the resulting `https://<your-app>.vercel.app` URL — that's what goes into the Slack manifest (step 2) as `https://<your-app>.vercel.app/api/slack`.

Once you've created the Slack app and the Supabase project, set the real env vars and redeploy so they take effect:

```bash
vercel env add SLACK_BOT_TOKEN
vercel env add SLACK_SIGNING_SECRET
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add OPS_CHANNEL_ID   # the #ops-requests channel ID, e.g. C0123456
vercel deploy --prod
```

### Local development

```bash
vercel dev
```

Then expose it with a tunnel (e.g. `ngrok http 3000`) and point the Slack app's Request URLs at the tunnel's HTTPS URL while iterating.

## How it works

See [db/schema.sql](db/schema.sql) for the data model and [src/app.ts](src/app.ts) for how all the commands/shortcuts/actions are wired up. The trickiest piece is [src/receiver/vercelReceiver.ts](src/receiver/vercelReceiver.ts), a custom Bolt `Receiver` (the same pattern as Bolt's official AWS Lambda receiver). [api/slack.ts](api/slack.ts) uses Vercel's Web Standard `fetch(request: Request)` handler shape rather than the legacy `req.body` helper, so the raw request body reaches the receiver untouched — required for Slack's signature verification, which needs the exact raw bytes Slack signed.
