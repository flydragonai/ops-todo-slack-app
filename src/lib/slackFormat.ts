// Slack mrkdwn requires escaping these three characters in any text that's
// interpolated into a larger mrkdwn string (e.g. inside <url|text> link syntax) —
// otherwise stray `<`/`>` from a captured message (mentions, links, etc.) can
// break the surrounding formatting.
export function escapeMrkdwn(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
