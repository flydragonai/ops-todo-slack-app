// Slack mrkdwn requires escaping these three characters in any text that's
// interpolated into a larger mrkdwn string (e.g. inside <url|text> link syntax) —
// otherwise stray `<`/`>` from a captured message (mentions, links, etc.) can
// break the surrounding formatting.
export function escapeMrkdwn(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Slack's <url|text> link syntax breaks (falls back to showing the raw brackets
// as plain text) if `text` spans multiple lines — collapse a captured message's
// line breaks/whitespace runs down to a single line before using it as a title.
export function toSingleLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

type NameLookup = { users: { info(args: { user: string }): Promise<{ user?: { real_name?: string; name?: string; profile?: { display_name?: string; real_name?: string } } }> } };
const names = new Map<string, string>();

/** A person's display name (cached per warm function instance); falls back to the raw id. */
export async function userName(client: NameLookup, id: string): Promise<string> {
  if (!names.has(id)) {
    try {
      const u = (await client.users.info({ user: id })).user;
      names.set(id, u?.profile?.display_name || u?.real_name || u?.profile?.real_name || u?.name || id);
    } catch {
      return id;
    }
  }
  return names.get(id)!;
}

/**
 * Slack mrkdwn → plain text for ticket titles and bodies: <@U123> → @Name, <#C123|general> → #general,
 * <!here> → @here, <url|label> → label (url), and &amp;/&lt;/&gt; unescaped.
 */
export async function plainSlackText(client: NameLookup, text: string): Promise<string> {
  const ids = [...new Set([...text.matchAll(/<@([UW][A-Z0-9]+)(?:\|[^>]*)?>/g)].map((m) => m[1]))];
  const resolved = new Map(await Promise.all(ids.map(async (id) => [id, await userName(client, id)] as const)));
  return text
    .replace(/<@([UW][A-Z0-9]+)(?:\|[^>]*)?>/g, (_, id: string) => `@${resolved.get(id) ?? id}`)
    .replace(/<#[CG][A-Z0-9]+\|([^>]*)>/g, '#$1')
    .replace(/<#([CG][A-Z0-9]+)>/g, '#$1')
    .replace(/<!subteam\^[A-Z0-9]+\|([^>]*)>/g, '$1')
    .replace(/<!(here|channel|everyone)(?:\|[^>]*)?>/g, '@$1')
    .replace(/<mailto:[^|>]+\|([^>]+)>/g, '$1')
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, (_, url: string, label: string) => (label === url ? url : `${label} (${url})`))
    .replace(/<(https?:[^>]+)>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
