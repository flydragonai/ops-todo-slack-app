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
