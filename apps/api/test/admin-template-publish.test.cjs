const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AdminTemplatesController } = require('../dist/admin-templates.controller.js');
const { AdminTemplatesService } = require('../dist/admin-templates.service.js');

function reply() {
  return {
    code: 200,
    body: null,
    status(code) { this.code = code; return this; },
    header() { return this; },
    send(body) { this.body = body; },
  };
}

const request = { cookies: { admin_session: 'test' }, ip: '127.0.0.1' };
const revision = 'a'.repeat(64);

test('运营管理员不能发布模板，且不调用发布服务', async () => {
  let called = false;
  const controller = new AdminTemplatesController(
    { session: async () => ({ id: 'operator', role: 'operator' }) },
    { publishXhsTitleDraft: async () => { called = true; } },
    {},
  );
  const response = reply();
  await controller.publishXhsTitleDraft({ revision }, request, response);
  assert.equal(response.code, 403);
  assert.equal(response.body.code, 'PERMISSION_DENIED');
  assert.equal(called, false);
});

test('旧版发布入口校验 revision 后引导使用带评估审核的新入口', async () => {
  const calls = [];
  const controller = new AdminTemplatesController(
    { session: async () => ({ id: 'super-admin', role: 'super_admin' }) },
    { publishXhsTitleDraft: async (...args) => {
      calls.push(args);
      return { version: 1, status: 'active', publishedAt: '2026-10-22T00:00:00.000Z', model: 'qwen-plus' };
    } },
    {},
  );
  const invalid = reply();
  await controller.publishXhsTitleDraft({ revision: 'wrong' }, request, invalid);
  assert.equal(invalid.code, 400);
  assert.equal(calls.length, 0);

  const valid = reply();
  await controller.publishXhsTitleDraft({ revision }, request, valid);
  assert.equal(valid.code, 409);
  assert.match(valid.body.message, /新版模板配置页/);
  assert.equal(calls.length, 0);
});

test('运营管理员可读取已发布版本，非法版本号不会查询详情', async () => {
  const calls = [];
  const controller = new AdminTemplatesController(
    { session: async () => ({ id: 'operator', role: 'operator' }) },
    {
      listXhsTitlePublishedVersions: async () => [{ version: 1, isCurrent: true }],
      getXhsTitlePublishedVersion: async (version) => {
        calls.push(version);
        return { version, isCurrent: true };
      },
    },
    {},
  );
  const list = await controller.xhsTitleVersions(request, reply());
  assert.equal(list.data[0].version, 1);

  const invalid = reply();
  await controller.xhsTitleVersionDetail('1foo', request, invalid);
  assert.equal(invalid.code, 400);
  assert.equal(calls.length, 0);

  const detail = await controller.xhsTitleVersionDetail('1', request, reply());
  assert.equal(detail.data.version, 1);
  assert.deepEqual(calls, [1]);
});

test('历史查询只包含已发布版本并标记当前版本', async () => {
  const service = new AdminTemplatesService();
  const statements = [];
  service.pool.query = async (sql) => {
    statements.push(sql);
    return { rows: [{
      version: 2,
      is_current: true,
      model: 'qwen-plus',
      change_log: '调整标题边界',
      published_at: new Date('2026-10-22T00:00:00.000Z'),
      published_by_username: 'admin',
    }] };
  };
  try {
    const versions = await service.listXhsTitlePublishedVersions();
    assert.match(statements[0], /v\.status = 'published'/);
    assert.deepEqual(versions, [{
      version: 2,
      isCurrent: true,
      model: 'qwen-plus',
      changeLog: '调整标题边界',
      publishedAt: '2026-10-22T00:00:00.000Z',
      publishedByUsername: 'admin',
    }]);
  } finally {
    await service.onModuleDestroy();
  }
});

test('版本详情只返回模型运行参数，不泄露误存的密钥字段', async () => {
  const service = new AdminTemplatesService();
  service.pool.query = async () => ({ rows: [{
    version: 1,
    is_current: true,
    model: 'qwen-plus',
    change_log: '初次发布',
    published_at: new Date('2026-10-22T00:00:00.000Z'),
    published_by_username: 'admin',
    system_prompt_version: 'SYSTEM_PROMPT_V1',
    developer_prompt: '生成五个标题',
    form_schema: { type: 'object' },
    output_schema: { type: 'object' },
    model_config: { provider: 'bailian', model: 'qwen-plus', maxTokens: 512, apiKey: 'do-not-expose' },
  }] });
  try {
    const detail = await service.getXhsTitlePublishedVersion(1);
    assert.equal(detail.modelConfig.model, 'qwen-plus');
    assert.equal('apiKey' in detail.modelConfig, false);
  } finally {
    await service.onModuleDestroy();
  }
});

test('运营管理员不能上下架模板', async () => {
  let called = false;
  const controller = new AdminTemplatesController(
    { session: async () => ({ id: 'operator', role: 'operator' }) },
    { changeXhsTitleAvailability: async () => { called = true; } },
    {},
  );
  const response = reply();
  await controller.changeXhsTitleAvailability({
    status: 'disabled', expectedStatus: 'active', expectedVersion: 1,
  }, request, response);
  assert.equal(response.code, 403);
  assert.equal(called, false);
});

test('上下架保留已发布版本并在同一事务内写入审计', async () => {
  const service = new AdminTemplatesService();
  const statements = [];
  let released = false;
  service.pool.connect = async () => ({
    query: async (sql, params) => {
      statements.push({ sql, params });
      if (sql.includes('FROM templates t')) return { rows: [{
        id: 'template-id', status: 'active', current_version_id: 'version-id',
        current_version: 1, version_status: 'published',
      }] };
      if (sql.startsWith('UPDATE templates')) return { rows: [{ updated_at: new Date('2026-10-22T00:00:00.000Z') }] };
      return { rows: [] };
    },
    release: () => { released = true; },
  });
  try {
    const result = await service.changeXhsTitleAvailability(
      { status: 'disabled', expectedStatus: 'active', expectedVersion: 1 },
      'admin-id', 'request-id', '127.0.0.1',
    );
    assert.equal(result.status, 'disabled');
    assert.equal(result.currentVersion, 1);
    assert.equal(statements[0].sql, 'BEGIN');
    assert.match(statements[2].sql, /^UPDATE templates SET status/);
    assert.doesNotMatch(statements[2].sql, /current_version_id/);
    assert.match(statements[3].sql, /INSERT INTO admin_audit_logs/);
    assert.equal(statements[3].params[2], 'template.disable');
    assert.equal(statements[4].sql, 'COMMIT');
    assert.equal(released, true);
  } finally {
    await service.onModuleDestroy();
  }
});

test('旧页面的状态或版本不匹配时拒绝上下架', async () => {
  const service = new AdminTemplatesService();
  const statements = [];
  service.pool.connect = async () => ({
    query: async (sql) => {
      statements.push(sql);
      return sql.includes('FROM templates t') ? { rows: [{
        id: 'template-id', status: 'active', current_version_id: 'version-id',
        current_version: 2, version_status: 'published',
      }] } : { rows: [] };
    },
    release: () => {},
  });
  try {
    const result = await service.changeXhsTitleAvailability(
      { status: 'disabled', expectedStatus: 'active', expectedVersion: 1 },
      'admin-id', 'request-id', '127.0.0.1',
    );
    assert.equal(result, 'conflict');
    assert.equal(statements.at(-1), 'ROLLBACK');
    assert.equal(statements.some((sql) => sql.startsWith('UPDATE templates')), false);
  } finally {
    await service.onModuleDestroy();
  }
});

test('重新上架沿用当前版本并记录启用动作', async () => {
  const service = new AdminTemplatesService();
  const statements = [];
  service.pool.connect = async () => ({
    query: async (sql, params) => {
      statements.push({ sql, params });
      if (sql.includes('FROM templates t')) return { rows: [{
        id: 'template-id', status: 'disabled', current_version_id: 'version-id',
        current_version: 1, version_status: 'published',
      }] };
      if (sql.startsWith('UPDATE templates')) return { rows: [{ updated_at: new Date('2026-10-22T00:00:00.000Z') }] };
      return { rows: [] };
    },
    release: () => {},
  });
  try {
    const result = await service.changeXhsTitleAvailability(
      { status: 'active', expectedStatus: 'disabled', expectedVersion: 1 },
      'admin-id', 'request-id', '127.0.0.1',
    );
    assert.equal(result.status, 'active');
    assert.equal(statements[2].params[1], 'active');
    assert.equal(statements[3].params[2], 'template.enable');
  } finally {
    await service.onModuleDestroy();
  }
});

test('运营管理员不能回滚，且非法目标版本不会进入服务', async () => {
  let called = false;
  const operator = new AdminTemplatesController(
    { session: async () => ({ id: 'operator', role: 'operator' }) },
    { rollbackXhsTitleVersion: async () => { called = true; } }, {},
  );
  const forbidden = reply();
  await operator.rollbackXhsTitleVersion('1', {
    expectedCurrentVersion: 2, expectedStatus: 'active', reason: '新版本质量下降',
  }, request, forbidden);
  assert.equal(forbidden.code, 403);
  assert.equal(called, false);

  const superAdmin = new AdminTemplatesController(
    { session: async () => ({ id: 'super-admin', role: 'super_admin' }) },
    { rollbackXhsTitleVersion: async () => { called = true; } }, {},
  );
  const invalid = reply();
  await superAdmin.rollbackXhsTitleVersion('1foo', {
    expectedCurrentVersion: 2, expectedStatus: 'active', reason: '新版本质量下降',
  }, request, invalid);
  assert.equal(invalid.code, 400);
  assert.equal(called, false);
});

test('回滚只切换到已发布版本，保留下架状态并写入审计', async () => {
  const service = new AdminTemplatesService();
  const statements = [];
  service.pool.connect = async () => ({
    query: async (sql, params) => {
      statements.push({ sql, params });
      if (sql.includes('FROM templates t')) return { rows: [{
        id: 'template-id', status: 'disabled', current_version_id: 'version-2',
        current_version: 2, version_status: 'published',
      }] };
      if (sql.includes('FROM template_versions')) return { rows: [{ id: 'version-1' }] };
      if (sql.startsWith('UPDATE templates')) return { rows: [{ updated_at: new Date('2026-10-22T00:00:00.000Z') }] };
      return { rows: [] };
    },
    release: () => {},
  });
  try {
    const result = await service.rollbackXhsTitleVersion(1,
      { expectedCurrentVersion: 2, expectedStatus: 'disabled', reason: '新版本质量下降' },
      'admin-id', 'request-id', '127.0.0.1');
    assert.equal(result.previousVersion, 2);
    assert.equal(result.currentVersion, 1);
    assert.equal(result.status, 'disabled');
    assert.match(statements[2].sql, /status = 'published'/);
    assert.match(statements[3].sql, /^UPDATE templates SET current_version_id/);
    assert.doesNotMatch(statements[3].sql, /status =/);
    assert.equal(statements[3].params[1], 'version-1');
    assert.match(statements[4].sql, /'template.rollback'/);
    assert.equal(JSON.parse(statements[4].params[5]).reason, '新版本质量下降');
    assert.equal(statements[5].sql, 'COMMIT');
  } finally {
    await service.onModuleDestroy();
  }
});

test('页面版本过期或目标版本未发布时不允许回滚', async () => {
  const service = new AdminTemplatesService();
  const statements = [];
  service.pool.connect = async () => ({
    query: async (sql) => {
      statements.push(sql);
      if (sql.includes('FROM templates t')) return { rows: [{
        id: 'template-id', status: 'active', current_version_id: 'version-2',
        current_version: 2, version_status: 'published',
      }] };
      return { rows: [] };
    },
    release: () => {},
  });
  try {
    const stale = await service.rollbackXhsTitleVersion(1,
      { expectedCurrentVersion: 3, expectedStatus: 'active', reason: '新版本质量下降' },
      'admin-id', 'request-id', '127.0.0.1');
    assert.equal(stale, 'conflict');
    const unpublished = await service.rollbackXhsTitleVersion(1,
      { expectedCurrentVersion: 2, expectedStatus: 'active', reason: '新版本质量下降' },
      'admin-id', 'request-id', '127.0.0.1');
    assert.equal(unpublished, 'not_found');
    assert.equal(statements.some((sql) => sql.startsWith('UPDATE templates')), false);
  } finally {
    await service.onModuleDestroy();
  }
});
