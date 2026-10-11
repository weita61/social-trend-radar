import { createHmac } from 'node:crypto';

export function pseudonymizeSubmitter(provider: 'discord' | 'slack', externalUserId: string, secret: string): string {
  if (secret.length < 16) throw new Error('SUBMITTER_HASH_SECRET must contain at least 16 characters');
  return createHmac('sha256', secret)
    .update(`${provider}:${externalUserId}`)
    .digest('hex');
}

