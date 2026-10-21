const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { hash } = require('@node-rs/argon2');
const { generateSecret, generateURI } = require('otplib');
const { encryptMfaSecret, readMfaKey } = require('../dist/admin-auth.crypto');

async function main() {
  const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
  if (!username || !/^[a-z0-9_.-]{3,80}$/.test(username) || !password || password.length < 12) {
    throw new Error('Username must be 3-80 lowercase letters/digits/._-; password at least 12 characters');
  }
  const key = readMfaKey();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
  try {
    const secret = generateSecret();
    const passwordHash = await hash(password);
    await pool.query(
      `INSERT INTO admin_users (id, username, password_hash, mfa_secret_ciphertext, role, status, updated_at)
       VALUES ($1, $2, $3, $4, 'super_admin', 'active', NOW())`,
      [randomUUID(), username, passwordHash, encryptMfaSecret(secret, key)],
    );
    process.stdout.write('管理员已创建。请立即将以下 TOTP URI 导入验证器，此 URI 只显示一次：\n');
    process.stdout.write(`${generateURI({ issuer: 'AI Copywriting Admin', label: username, secret })}\n`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
