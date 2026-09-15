import crypto from 'node:crypto';
import tsscmp from 'tsscmp';

export function isValidSlackSignature(
  signingSecret: string,
  rawBody: string,
  signature: string | undefined,
  requestTimestamp: number,
): boolean {
  if (!signature || Number.isNaN(requestTimestamp)) return false;

  // reject requests older than 5 minutes to guard against replay attacks
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (requestTimestamp < fiveMinutesAgo) return false;

  const [version, hash] = signature.split('=');
  const hmac = crypto.createHmac('sha256', signingSecret);
  hmac.update(`${version}:${requestTimestamp}:${rawBody}`);

  return tsscmp(hash, hmac.digest('hex'));
}
