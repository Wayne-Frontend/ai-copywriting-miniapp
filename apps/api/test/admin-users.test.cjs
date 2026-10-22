const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomBytes } = require('node:crypto')
process.env.ADMIN_MFA_KEY = randomBytes(32).toString('base64')
const { AdminUsersService, AdminUserError, parseProfile } = require('../dist/admin-users.service')
const { AdminUsersController } = require('../dist/admin-users.controller')
const { encryptMfaSecret } = require('../dist/admin-auth.crypto')
const { generate, generateSecret } = require('otplib')

const profile = () => ({
  nickname: null, realName: null, gender: null, phone: null, email: null,
  department: null, avatarKey: null, address: null, bio: null
})
const reply = () => ({
  code: 200, body: null, status(code) { this.code = code; return this },
  send(body) { this.body = body }, header() { return this }
})

test('profile accepts nullable migrated fields and rejects unknown or invalid values', () => {
  assert.deepEqual(parseProfile(profile()), profile())
  assert.throws(() => parseProfile({ ...profile(), unexpected: 'x' }), AdminUserError)
  assert.throws(() => parseProfile({ ...profile(), phone: '123' }), AdminUserError)
  assert.throws(() => parseProfile({ ...profile(), avatarKey: 'remote-url' }), AdminUserError)
})

test('operator cannot query admin users even if a service method exists', async () => {
  let called = false
  const controller = new AdminUsersController(
    { session: async () => ({ id: 'operator', role: 'operator' }) },
    { list: async () => { called = true } }
  )
  const res = reply()
  await controller.list({}, { cookies: {}, ip: '127.0.0.1' }, res)
  assert.equal(res.code, 403)
  assert.equal(res.body.code, 'PERMISSION_DENIED')
  assert.equal(called, false)
})

test('super admin list uses real filters and never returns password or MFA secret', async () => {
  const service = new AdminUsersService()
  const queries = []
  service.pool.query = async (sql, values) => {
    queries.push({ sql, values })
    if (sql.includes('count(*)')) return { rows: [{ total: 1 }] }
    return { rows: [{
      id: 'id-1', username: 'editor', nickname: null, real_name: null,
      gender: null, phone: null, email: null, department: null, avatar_key: null,
      address: null, bio: null, role: 'operator', status: 'active', online: false,
      created_at: new Date('2026-10-22T00:00:00Z'),
      updated_at: new Date('2026-10-22T00:00:00Z'),
      last_login_at: null, created_by_name: 'admin', updated_by_name: null,
      password_hash: 'must-not-leak', mfa_secret_ciphertext: 'must-not-leak'
    }] }
  }
  try {
    const result = await service.list({ current: 1, size: 20, userName: 'editor', status: 'active' })
    assert.equal(result.total, 1)
    assert.equal(result.records[0].username, 'editor')
    assert.equal(result.records[0].createdBy, 'admin')
    assert.equal(JSON.stringify(result).includes('must-not-leak'), false)
    assert.equal(queries[0].values[0], '%editor%')
    assert.equal(queries[0].values[1], 'active')
  } finally { await service.onModuleDestroy() }
})

test('last active super admin cannot be demoted', async () => {
  const service = new AdminUsersService()
  const log = []
  const client = {
    async query(sql) {
      log.push(sql)
      if (sql.includes('SELECT role,status')) return { rows: [{ role: 'super_admin', status: 'active' }] }
      if (sql.includes('count(*)')) return { rows: [{ total: 0 }] }
      return { rows: [] }
    },
    release() {}
  }
  service.pool.connect = async () => client
  try {
    await assert.rejects(
      service.changeAccess('target', 'operator', 'active', 'actor', 'req', '127.0.0.1'),
      (error) => error.code === 'LAST_SUPER_ADMIN'
    )
    assert.ok(log.includes('ROLLBACK'))
    assert.equal(log.some((sql) => sql.startsWith('UPDATE admin_users')), false)
  } finally { await service.onModuleDestroy() }
})

test('created account starts pending MFA and returns URI only in the creation response', async () => {
  const service = new AdminUsersService()
  const statements = []
  service.pool.connect = async () => ({
    async query(sql, params) { statements.push({ sql, params }); return { rows: [] } },
    release() {}
  })
  service.one = async (id) => ({ id, username: 'newadmin', status: 'pending_mfa' })
  try {
    const result = await service.create({ username: 'NewAdmin', password: 'very-long-password',
      role: 'operator', profile: profile() }, 'actor', 'req', '127.0.0.1')
    assert.equal(result.user.status, 'pending_mfa')
    assert.match(result.mfaUri, /^otpauth:\/\/totp\//)
    const insert = statements.find((item) => item.sql.includes('INSERT INTO admin_users'))
    assert.ok(insert)
    assert.ok(insert.sql.includes("'pending_mfa'"))
    assert.notEqual(insert.params[2], 'very-long-password')
    assert.ok(insert.params[3].startsWith('v1:'))
    assert.equal(statements.some((item) => JSON.stringify(item.params ?? []).includes('otpauth://')), false)
  } finally { await service.onModuleDestroy() }
})

test('password reset revokes sessions and audits without recording the password', async () => {
  const service = new AdminUsersService()
  const statements = []
  service.pool.connect = async () => ({
    async query(sql, params) {
      statements.push({ sql, params })
      if (sql.includes('RETURNING id')) return { rows: [{ id: 'target' }] }
      return { rows: [] }
    },
    release() {}
  })
  try {
    await service.resetPassword('target', 'another-long-password', 'actor', 'req', '127.0.0.1')
    assert.ok(statements.some((item) => item.sql.includes('UPDATE admin_sessions SET revoked_at')))
    const audit = statements.find((item) => item.sql.includes('INSERT INTO admin_audit_logs'))
    assert.ok(audit)
    assert.equal(JSON.stringify(audit.params).includes('another-long-password'), false)
    assert.ok(statements.some((item) => item.sql === 'COMMIT'))
  } finally { await service.onModuleDestroy() }
})

test('MFA binding activates an account only after a valid verifier code', async () => {
  const service = new AdminUsersService()
  const secret = generateSecret()
  const token = await generate({ secret })
  const statements = []
  service.pool.connect = async () => ({
    async query(sql, params) {
      statements.push({ sql, params })
      if (sql.includes('SELECT status,mfa_secret_ciphertext')) return { rows: [{
        status: 'pending_mfa', mfa_secret_ciphertext: encryptMfaSecret(secret, service.mfaKey)
      }] }
      return { rows: [] }
    }, release() {}
  })
  service.one = async (id) => ({ id, status: 'active' })
  try {
    await assert.rejects(service.confirmMfa('target', '0000000', 'actor', 'req', '127.0.0.1'),
      (error) => error.code === 'VALIDATION_ERROR')
    assert.equal(statements.some((item) => item.sql.includes("SET status='active'")), false)
    const result = await service.confirmMfa('target', token, 'actor', 'req', '127.0.0.1')
    assert.equal(result.status, 'active')
    assert.ok(statements.some((item) => item.sql.includes("SET status='active'")))
    assert.ok(statements.some((item) => item.sql.includes('INSERT INTO admin_audit_logs')))
  } finally { await service.onModuleDestroy() }
})
