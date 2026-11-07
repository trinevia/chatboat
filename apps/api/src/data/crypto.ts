import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for data-source passwords at rest. The key comes from
 * DATA_ENCRYPTION_KEY (any string; hashed to 32 bytes). Changing the key makes
 * saved passwords unreadable, so admins would need to re-enter them.
 */
function key() {
  const raw = process.env.DATA_ENCRYPTION_KEY;
  if (!raw) throw new Error('DATA_ENCRYPTION_KEY is not set. Generate one with: openssl rand -hex 32');
  return createHash('sha256').update(raw).digest();
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

export function decrypt(token: string): string {
  const [version, iv, tag, data] = token.split(':');
  if (version !== 'v1') throw new Error('Unknown secret format');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
