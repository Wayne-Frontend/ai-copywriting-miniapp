import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function readMfaKey(): Buffer {
  const encoded = process.env.ADMIN_MFA_KEY;
  const key = encoded ? Buffer.from(encoded, 'base64') : Buffer.alloc(0);
  if (key.length !== 32) {
    throw new Error('ADMIN_MFA_KEY must be a base64-encoded 32-byte key');
  }
  return key;
}

// MFA 密钥必须可在服务重启后解密，因此使用独立的持久环境密钥；每条记录单独随机 IV。
export function encryptMfaSecret(secret: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ciphertext.toString('base64')}`;
}

export function decryptMfaSecret(value: string, key: Buffer): string {
  const [version, iv, tag, ciphertext] = value.split(':');
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Invalid MFA secret');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
