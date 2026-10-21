import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { hash, verify as verifyPassword } from '@node-rs/argon2';
import { verify as verifyTotp } from 'otplib';
import { Pool, PoolClient } from 'pg';
import { decryptMfaSecret, hashToken, readMfaKey } from './admin-auth.crypto';

export interface AdminIdentity {
  id: string;
  username: string;
  role: string;
}

interface AdminRow extends AdminIdentity {
  password_hash: string;
  mfa_secret_ciphertext: string;
  status: string;
  last_totp_step: string | null;
}

const SESSION_SECONDS = 8 * 60 * 60;

@Injectable()
export class AdminAuthService implements OnModuleDestroy {
  private readonly pool: Pool;
  private readonly mfaKey: Buffer;
  private readonly dummyHash: Promise<string>;

  constructor() {
    this.mfaKey = readMfaKey();
    this.pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5,
      connectionTimeoutMillis: 2000 });
    this.dummyHash = hash(randomBytes(32).toString('hex'));
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }

  private async limitAttempt(client: PoolClient, key: string, threshold: number): Promise<boolean> {
    // UPSERT 在数据库中串行更新同一 key，避免并发请求绕过进程内计数器。
    const result = await client.query<{ attempts: number; locked_until: Date | null }>(
      `INSERT INTO admin_login_limits (key, attempts, window_start, locked_until, updated_at)
       VALUES ($1, 1, NOW(), NULL, NOW())
       ON CONFLICT (key) DO UPDATE SET
         attempts = CASE WHEN admin_login_limits.window_start < NOW() - INTERVAL '15 minutes'
           THEN 1 ELSE admin_login_limits.attempts + 1 END,
         window_start = CASE WHEN admin_login_limits.window_start < NOW() - INTERVAL '15 minutes'
           THEN NOW() ELSE admin_login_limits.window_start END,
         locked_until = CASE
           WHEN admin_login_limits.locked_until > NOW() THEN admin_login_limits.locked_until
           WHEN admin_login_limits.window_start < NOW() - INTERVAL '15 minutes' THEN NULL
           WHEN admin_login_limits.attempts + 1 >= $2 THEN NOW() + INTERVAL '15 minutes'
           ELSE NULL END,
         updated_at = NOW()
       RETURNING attempts, locked_until`,
      [key, threshold],
    );
    const row = result.rows[0];
    return !!row?.locked_until && row.locked_until.getTime() > Date.now();
  }

  async login(username: string, password: string, totp: string, ip: string): Promise<{ identity: AdminIdentity; token: string } | 'invalid' | 'limited'> {
    const normalized = username.trim().toLowerCase();
    const client = await this.pool.connect();
    try {
      // 账号和来源双重限制；哈希后的 key 不泄漏原始用户名/IP 到限制表。
      const accountKey = hashToken(`account:${normalized}`);
      const ipKey = hashToken(`ip:${ip}`);
      const accountLimited = await this.limitAttempt(client, accountKey, 5);
      const ipLimited = await this.limitAttempt(client, ipKey, 20);
      if (accountLimited || ipLimited) return 'limited';

      const result = await client.query<AdminRow>(
        `SELECT id, username, role, status, password_hash, mfa_secret_ciphertext, last_totp_step
         FROM admin_users WHERE username = $1`,
        [normalized],
      );
      const admin = result.rows[0];
      const passwordValid = await verifyPassword(admin?.password_hash ?? await this.dummyHash, password);
      if (!admin || admin.status !== 'active' || !passwordValid) return 'invalid';

      const secret = decryptMfaSecret(admin.mfa_secret_ciphertext, this.mfaKey);
      const otp = await verifyTotp({ secret, token: totp, epochTolerance: [30, 0],
        afterTimeStep: admin.last_totp_step === null ? undefined : Number(admin.last_totp_step) });
      if (!otp.valid || !('timeStep' in otp)) return 'invalid';

      // 原子推进 TOTP 步数，同一验证码即使并发提交也只能创建一个会话。
      await client.query('BEGIN');
      try {
      const updated = await client.query(
        `UPDATE admin_users SET last_totp_step = $2, last_login_at = NOW(), updated_at = NOW()
         WHERE id = $1 AND (last_totp_step IS NULL OR last_totp_step < $2)`,
        [admin.id, otp.timeStep],
      );
      if (updated.rowCount !== 1) {
        await client.query('ROLLBACK');
        return 'invalid';
      }

      const token = randomBytes(32).toString('base64url');
      await client.query(
        `INSERT INTO admin_sessions (id, admin_user_id, token_hash, expires_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '8 hours')`,
        [randomUUID(), admin.id, hashToken(token)],
      );
      await client.query('DELETE FROM admin_login_limits WHERE key = $1', [accountKey]);
      await client.query('COMMIT');
      return { identity: { id: admin.id, username: admin.username, role: admin.role }, token };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    } finally {
      client.release();
    }
  }

  async session(token: string | undefined): Promise<AdminIdentity | null> {
    if (!token) return null;
    const result = await this.pool.query<AdminIdentity>(
      `SELECT a.id, a.username, a.role FROM admin_sessions s
       JOIN admin_users a ON a.id = s.admin_user_id
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
         AND a.status = 'active'`,
      [hashToken(token)],
    );
    return result.rows[0] ?? null;
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.pool.query(
      'UPDATE admin_sessions SET revoked_at = NOW() WHERE token_hash = $1 AND revoked_at IS NULL',
      [hashToken(token)],
    );
  }

  get sessionSeconds(): number { return SESSION_SECONDS; }
}
