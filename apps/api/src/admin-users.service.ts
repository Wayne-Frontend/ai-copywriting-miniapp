import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { hash, verify as verifyPassword } from '@node-rs/argon2';
import { generateSecret, generateURI, verify as verifyTotp } from 'otplib';
import { Pool, type PoolClient } from 'pg';
import { decryptMfaSecret, encryptMfaSecret, readMfaKey } from './admin-auth.crypto';

export type AdminRole = 'super_admin' | 'operator';
export type AdminStatus = 'pending_mfa' | 'active' | 'disabled';
export type Profile = {
  nickname: string | null; realName: string | null; gender: 'male' | 'female' | 'other' | null;
  phone: string | null; email: string | null; department: string | null;
  avatarKey: string | null; address: string | null; bio: string | null;
};
export interface AdminUserRecord extends Profile {
  id: string; username: string; role: AdminRole; status: AdminStatus; online: boolean;
  createdAt: string; updatedAt: string; createdBy: string | null; updatedBy: string | null;
  lastLoginAt: string | null;
}

export class AdminUserError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}

const fields = ['nickname', 'realName', 'gender', 'phone', 'email', 'department', 'avatarKey', 'address', 'bio'] as const;
const limits: Record<(typeof fields)[number], number> = {
  nickname: 80, realName: 80, gender: 8, phone: 20, email: 254,
  department: 80, avatarKey: 20, address: 200, bio: 500,
};
const SELECT = `a.id, a.username, a.nickname, a.real_name, a.gender, a.phone, a.email,
  a.department, a.avatar_key, a.address, a.bio, a.role, a.status, a.created_at,
  a.updated_at, a.last_login_at, creator.username AS created_by_name,
  updater.username AS updated_by_name,
  EXISTS (SELECT 1 FROM admin_sessions s WHERE s.admin_user_id = a.id
    AND s.revoked_at IS NULL AND s.expires_at > NOW()) AS online`;
const FROM = `FROM admin_users a LEFT JOIN admin_users creator ON creator.id = a.created_by
  LEFT JOIN admin_users updater ON updater.id = a.updated_by`;

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export function parseProfile(input: unknown): Profile {
  if (!object(input) || Object.keys(input).sort().join(',') !== [...fields].sort().join(',')) {
    throw new AdminUserError(400, 'VALIDATION_ERROR', '管理员资料字段不完整');
  }
  const result: Record<string, string | null> = {};
  for (const key of fields) {
    const value = input[key];
    if (value !== null && (typeof value !== 'string' || value.trim().length > limits[key])) {
      throw new AdminUserError(400, 'VALIDATION_ERROR', `${key} 格式不正确`);
    }
    result[key] = value === null || !value.trim() ? null : value.trim();
  }
  if (result.gender && !['male', 'female', 'other'].includes(result.gender)) {
    throw new AdminUserError(400, 'VALIDATION_ERROR', '性别选项不正确');
  }
  if (result.avatarKey && !/^avatar(10|[1-9])$/.test(result.avatarKey)) {
    throw new AdminUserError(400, 'VALIDATION_ERROR', '头像选项不正确');
  }
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) {
    throw new AdminUserError(400, 'VALIDATION_ERROR', '邮箱格式不正确');
  }
  if (result.phone && !/^1[3-9]\d{9}$/.test(result.phone)) {
    throw new AdminUserError(400, 'VALIDATION_ERROR', '手机号格式不正确');
  }
  return result as Profile;
}
function rowToUser(row: Record<string, unknown>): AdminUserRecord {
  const date = (value: unknown) => value instanceof Date ? value.toISOString() : null;
  return {
    id: String(row.id), username: String(row.username), role: row.role as AdminRole,
    status: row.status as AdminStatus, online: row.online === true,
    nickname: row.nickname as string | null, realName: row.real_name as string | null,
    gender: row.gender as Profile['gender'], phone: row.phone as string | null,
    email: row.email as string | null, department: row.department as string | null,
    avatarKey: row.avatar_key as string | null, address: row.address as string | null,
    bio: row.bio as string | null, createdAt: date(row.created_at) ?? '',
    updatedAt: date(row.updated_at) ?? '', lastLoginAt: date(row.last_login_at),
    createdBy: row.created_by_name as string | null, updatedBy: row.updated_by_name as string | null,
  };
}

@Injectable()
export class AdminUsersService implements OnModuleDestroy {
  private readonly pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 2000 });
  private readonly mfaKey = readMfaKey();
  async onModuleDestroy(): Promise<void> { await this.pool.end(); }

  private async audit(client: PoolClient, actor: string, action: string, target: string,
    requestId: string, ip: string, summary: Record<string, unknown>) {
    // 审计只保留字段名和非敏感权限变化，绝不写入密码、MFA URI 或个人资料值。
    await client.query(`INSERT INTO admin_audit_logs
      (id, admin_user_id, action, resource_type, resource_id, request_id, ip_hash, change_summary)
      VALUES ($1,$2,$3,'admin_user',$4,$5,$6,$7::jsonb)`,
    [randomUUID(), actor, action, target, requestId,
      createHash('sha256').update(ip).digest('hex'), JSON.stringify(summary)]);
  }
  private async transaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  private async one(id: string): Promise<AdminUserRecord> {
    const result = await this.pool.query(`SELECT ${SELECT} ${FROM} WHERE a.id=$1`, [id]);
    if (!result.rows[0]) throw new AdminUserError(404, 'NOT_FOUND', '管理员不存在');
    return rowToUser(result.rows[0]);
  }
  async me(id: string) { return this.one(id); }
  async list(query: Record<string, unknown>) {
    const current = Number(query.current ?? 1), size = Number(query.size ?? 20);
    if (!Number.isSafeInteger(current) || current < 1 || !Number.isSafeInteger(size) || size < 1 || size > 100) {
      throw new AdminUserError(400, 'VALIDATION_ERROR', '分页参数不正确');
    }
    const values: unknown[] = [];
    const where: string[] = [];
    for (const [name, column] of [['userName', 'username'], ['userPhone', 'phone'],
      ['userEmail', 'email']] as const) {
      const value = query[name];
      if (value === undefined || value === '') continue;
      if (typeof value !== 'string' || value.length > 80) throw new AdminUserError(400, 'VALIDATION_ERROR', '搜索条件不正确');
      values.push(`%${value.replace(/[\\%_]/g, '\\$&')}%`);
      where.push(`a.${column} ILIKE $${values.length} ESCAPE '\\'`);
    }
    for (const [name, allowed] of [['status', ['pending_mfa', 'active', 'disabled']],
      ['role', ['super_admin', 'operator']], ['userGender', ['male', 'female', 'other']]] as const) {
      const value = query[name];
      if (value === undefined || value === '') continue;
      if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
        throw new AdminUserError(400, 'VALIDATION_ERROR', '搜索条件不正确');
      }
      values.push(value);
      where.push(`a.${name === 'userGender' ? 'gender' : name}=$${values.length}`);
    }
    const condition = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const count = await this.pool.query(`SELECT count(*)::int AS total FROM admin_users a ${condition}`, values);
    const rows = await this.pool.query(`SELECT ${SELECT} ${FROM} ${condition}
      ORDER BY a.created_at DESC, a.id DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, size, (current - 1) * size]);
    return { records: rows.rows.map(rowToUser), current, size, total: count.rows[0].total as number };
  }
  async create(input: { username: string; password: string; role: AdminRole; profile: Profile },
    actor: string, requestId: string, ip: string) {
    const username = input.username.trim().toLowerCase();
    if (!/^[a-z0-9_.-]{3,80}$/.test(username) || input.password.length < 12 ||
      input.password.length > 1024 || !['super_admin', 'operator'].includes(input.role)) {
      throw new AdminUserError(400, 'VALIDATION_ERROR', '账号、密码或角色不正确');
    }
    const secret = generateSecret();
    const passwordHash = await hash(input.password);
    const id = randomUUID();
    try {
      await this.transaction(async (client) => {
        await client.query(`INSERT INTO admin_users
          (id,username,password_hash,mfa_secret_ciphertext,role,status,nickname,real_name,gender,
           phone,email,department,avatar_key,address,bio,created_by,updated_by,updated_at)
          VALUES ($1,$2,$3,$4,$5,'pending_mfa',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$15,NOW())`,
        [id, username, passwordHash, encryptMfaSecret(secret, this.mfaKey), input.role,
          input.profile.nickname, input.profile.realName, input.profile.gender, input.profile.phone,
          input.profile.email, input.profile.department, input.profile.avatarKey,
          input.profile.address, input.profile.bio, actor]);
        await this.audit(client, actor, 'admin_user.create', id, requestId, ip, { role: input.role });
      });
    } catch (error) {
      if (object(error) && error.code === '23505') throw new AdminUserError(409, 'CONFLICT', '管理员账号已存在');
      throw error;
    }
    return { user: await this.one(id), mfaUri: generateURI({ issuer: 'AI Copywriting Admin', label: username, secret }) };
  }
  async updateProfile(id: string, profile: Profile, actor: string, requestId: string, ip: string) {
    await this.transaction(async (client) => {
      const found = await client.query('SELECT id FROM admin_users WHERE id=$1 FOR UPDATE', [id]);
      if (!found.rows[0]) throw new AdminUserError(404, 'NOT_FOUND', '管理员不存在');
      await client.query(`UPDATE admin_users SET nickname=$2,real_name=$3,gender=$4,phone=$5,
        email=$6,department=$7,avatar_key=$8,address=$9,bio=$10,updated_by=$11,updated_at=NOW()
        WHERE id=$1`, [id, profile.nickname, profile.realName, profile.gender, profile.phone,
        profile.email, profile.department, profile.avatarKey, profile.address, profile.bio, actor]);
      await this.audit(client, actor, 'admin_user.profile', id, requestId, ip, { fields });
    });
    return this.one(id);
  }
  private async protectLastSuper(client: PoolClient, targetId: string) {
    // 串行化高权限变更，防止两个请求同时停用各自看到的“倒数第二个”超管。
    await client.query('SELECT pg_advisory_xact_lock(725901)');
    const count = await client.query(`SELECT count(*)::int AS total FROM admin_users
      WHERE role='super_admin' AND status='active' AND id<>$1`, [targetId]);
    if (count.rows[0].total < 1) throw new AdminUserError(409, 'LAST_SUPER_ADMIN', '必须保留至少一位可用的超级管理员');
  }
  async changeAccess(id: string, role: AdminRole, status: 'active' | 'disabled',
    actor: string, requestId: string, ip: string) {
    if (!['super_admin', 'operator'].includes(role) || !['active', 'disabled'].includes(status)) {
      throw new AdminUserError(400, 'VALIDATION_ERROR', '角色或状态不正确');
    }
    await this.transaction(async (client) => {
      const found = await client.query('SELECT role,status FROM admin_users WHERE id=$1 FOR UPDATE', [id]);
      const previous = found.rows[0];
      if (!previous) throw new AdminUserError(404, 'NOT_FOUND', '管理员不存在');
      if (previous.status === 'pending_mfa') throw new AdminUserError(409, 'CONFLICT', '请先完成 MFA 绑定');
      if (id === actor && (role !== previous.role || status !== 'active')) {
        throw new AdminUserError(409, 'CONFLICT', '不能修改自己的角色或停用自己的账号');
      }
      if (previous.role === 'super_admin' && previous.status === 'active' &&
        (role !== 'super_admin' || status !== 'active')) await this.protectLastSuper(client, id);
      await client.query('UPDATE admin_users SET role=$2,status=$3,updated_by=$4,updated_at=NOW() WHERE id=$1',
        [id, role, status, actor]);
      if (role !== previous.role || status !== 'active') await client.query(
        'UPDATE admin_sessions SET revoked_at=NOW() WHERE admin_user_id=$1 AND revoked_at IS NULL', [id]);
      await this.audit(client, actor, 'admin_user.access', id, requestId, ip,
        { fromRole: previous.role, toRole: role, fromStatus: previous.status, toStatus: status });
    });
    return this.one(id);
  }
  async resetPassword(id: string, password: string, actor: string, requestId: string, ip: string) {
    if (password.length < 12 || password.length > 1024) throw new AdminUserError(400, 'VALIDATION_ERROR', '密码至少 12 位');
    const passwordHash = await hash(password);
    await this.transaction(async (client) => {
      const result = await client.query('UPDATE admin_users SET password_hash=$2,updated_by=$3,updated_at=NOW() WHERE id=$1 RETURNING id',
        [id, passwordHash, actor]);
      if (!result.rows[0]) throw new AdminUserError(404, 'NOT_FOUND', '管理员不存在');
      await client.query('UPDATE admin_sessions SET revoked_at=NOW() WHERE admin_user_id=$1 AND revoked_at IS NULL', [id]);
      await this.audit(client, actor, 'admin_user.password_reset', id, requestId, ip, {});
    });
  }
  async resetMfa(id: string, actor: string, requestId: string, ip: string) {
    if (id === actor) throw new AdminUserError(409, 'CONFLICT', '不能重置自己的 MFA');
    const secret = generateSecret();
    const username = await this.transaction(async (client) => {
      const found = await client.query('SELECT username,role,status FROM admin_users WHERE id=$1 FOR UPDATE', [id]);
      const previous = found.rows[0];
      if (!previous) throw new AdminUserError(404, 'NOT_FOUND', '管理员不存在');
      if (previous.role === 'super_admin' && previous.status === 'active') await this.protectLastSuper(client, id);
      await client.query(`UPDATE admin_users SET mfa_secret_ciphertext=$2,last_totp_step=NULL,
        status='pending_mfa',updated_by=$3,updated_at=NOW() WHERE id=$1`,
      [id, encryptMfaSecret(secret, this.mfaKey), actor]);
      await client.query('UPDATE admin_sessions SET revoked_at=NOW() WHERE admin_user_id=$1 AND revoked_at IS NULL', [id]);
      await this.audit(client, actor, 'admin_user.mfa_reset', id, requestId, ip, {});
      return previous.username as string;
    });
    return { user: await this.one(id), mfaUri: generateURI({ issuer: 'AI Copywriting Admin', label: username, secret }) };
  }
  async confirmMfa(id: string, token: string, actor: string, requestId: string, ip: string) {
    if (!/^\d{6}$/.test(token)) throw new AdminUserError(400, 'VALIDATION_ERROR', '请输入六位验证码');
    await this.transaction(async (client) => {
      const found = await client.query('SELECT status,mfa_secret_ciphertext FROM admin_users WHERE id=$1 FOR UPDATE', [id]);
      const row = found.rows[0];
      if (!row) throw new AdminUserError(404, 'NOT_FOUND', '管理员不存在');
      if (row.status !== 'pending_mfa') throw new AdminUserError(409, 'CONFLICT', '该账号无需绑定 MFA');
      const secret = decryptMfaSecret(row.mfa_secret_ciphertext, this.mfaKey);
      const valid = await verifyTotp({ secret, token, epochTolerance: [30, 0] });
      if (!valid.valid || !('timeStep' in valid)) throw new AdminUserError(400, 'VALIDATION_ERROR', '验证码不正确');
      await client.query(`UPDATE admin_users SET status='active',last_totp_step=$2,updated_by=$3,updated_at=NOW()
        WHERE id=$1`, [id, valid.timeStep, actor]);
      await this.audit(client, actor, 'admin_user.mfa_confirm', id, requestId, ip, {});
    });
    return this.one(id);
  }
  async changeOwnPassword(id: string, oldPassword: string, newPassword: string,
    token: string, requestId: string, ip: string) {
    if (!oldPassword || newPassword.length < 12 || newPassword.length > 1024 || !/^\d{6}$/.test(token)) {
      throw new AdminUserError(400, 'VALIDATION_ERROR', '密码或验证码格式不正确');
    }
    const newHash = await hash(newPassword);
    await this.transaction(async (client) => {
      const found = await client.query(`SELECT password_hash,mfa_secret_ciphertext,last_totp_step
        FROM admin_users WHERE id=$1 FOR UPDATE`, [id]);
      const row = found.rows[0];
      if (!row || !await verifyPassword(row.password_hash, oldPassword)) {
        throw new AdminUserError(400, 'VALIDATION_ERROR', '旧密码或验证码不正确');
      }
      const secret = decryptMfaSecret(row.mfa_secret_ciphertext, this.mfaKey);
      const valid = await verifyTotp({ secret, token, epochTolerance: [30, 0],
        afterTimeStep: row.last_totp_step === null ? undefined : Number(row.last_totp_step) });
      if (!valid.valid || !('timeStep' in valid)) throw new AdminUserError(400, 'VALIDATION_ERROR', '旧密码或验证码不正确');
      await client.query(`UPDATE admin_users SET password_hash=$2,last_totp_step=$3,updated_at=NOW()
        WHERE id=$1`, [id, newHash, valid.timeStep]);
      await client.query('UPDATE admin_sessions SET revoked_at=NOW() WHERE admin_user_id=$1 AND revoked_at IS NULL', [id]);
      await this.audit(client, id, 'admin_user.password_change', id, requestId, ip, {});
    });
  }
}
