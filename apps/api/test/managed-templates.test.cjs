const { test } = require('node:test');
const assert = require('node:assert/strict');
const { TEMPLATE_DEFINITIONS, defaultFormSchema, defaultOutputSchema } = require('../dist/template-definitions.js');
const { validTemplateSchemas, validateValue } = require('../dist/template-schema.js');
const { ManagedTemplatesController } = require('../dist/managed-templates.controller.js');
const { ManagedTemplatesService } = require('../dist/managed-templates.service.js');

function reply() {
  return { code: 200, body: null, status(code) { this.code = code; return this; },
    header() { return this; }, send(body) { this.body = body; } };
}
const request = { cookies: { admin_session: 'test' }, ip: '127.0.0.1' };

test('10 个模板的固定结构可用，禁止改字段键、枚举和输出结构', () => {
  assert.equal(Object.keys(TEMPLATE_DEFINITIONS).length, 10);
  for (const code of Object.keys(TEMPLATE_DEFINITIONS)) {
    assert.equal(validTemplateSchemas(code, defaultFormSchema(code), defaultOutputSchema(code)), true, code);
  }
  const form = defaultFormSchema('XHS_TITLE');
  const output = defaultOutputSchema('XHS_TITLE');
  form.properties.topic.title = '新的展示标题';
  assert.equal(validTemplateSchemas('XHS_TITLE', form, output), true);
  form.properties.extra = { type: 'string' };
  assert.equal(validTemplateSchemas('XHS_TITLE', form, output), false);
  delete form.properties.extra;
  form.properties.style.enum = ['随意'];
  assert.equal(validTemplateSchemas('XHS_TITLE', form, output), false);
  form.properties.style.enum = ['真实', '活泼', '专业'];
  output.properties.items.maxItems = 10;
  assert.equal(validTemplateSchemas('XHS_TITLE', form, output), false);
  const legacyForm = defaultFormSchema('XHS_TITLE');
  delete legacyForm.properties.topic.title;
  legacyForm.properties.style.default = '真实';
  assert.equal(validTemplateSchemas('XHS_TITLE', legacyForm, defaultOutputSchema('XHS_TITLE')), true);
});

test('测试样本与模型输出按字段结构逐层校验', () => {
  const form = defaultFormSchema('VIDEO_SPEECH');
  assert.equal(validateValue({ topic: '周末活动', keyPoints: '活动开始前先准备材料和场地',
    durationSeconds: 60, style: '自然' }, form), true);
  assert.equal(validateValue({ topic: '周末活动', keyPoints: '活动开始前先准备材料和场地',
    durationSeconds: '60', style: '自然' }, form), false);
  assert.equal(validateValue({ topic: '周末活动', keyPoints: '活动开始前先准备材料和场地',
    durationSeconds: 60, style: '自然', unknown: 'x' }, form), false);
  const output = defaultOutputSchema('MEETING_NOTES');
  assert.equal(validateValue({ title: '讨论会', meetingDate: null, participants: [], discussionPoints: [],
    decisions: [], actionItems: [{ task: '核对资料', owner: null, dueDate: null }], openQuestions: [] }, output), true);
});

test('运营员不能审核和发布，服务端不会调用对应业务方法', async () => {
  let called = false;
  const controller = new ManagedTemplatesController(
    { session: async () => ({ id: 'operator', role: 'operator' }) },
    { reviewDraft: async () => { called = true; }, publishDraft: async () => { called = true; } });
  const reviewed = reply();
  await controller.review('XHS_SCRIPT', { revision: 'a'.repeat(64), note: '检查通过' }, request, reviewed);
  assert.equal(reviewed.code, 403);
  const published = reply();
  await controller.publish('XHS_SCRIPT', { revision: 'a'.repeat(64) }, request, published);
  assert.equal(published.code, 403);
  assert.equal(called, false);
});

test('测试失败时区分百炼 HTTP、输出结构和无依据数字，并向页面返回明确提示', async () => {
  const previousKey = process.env.DASHSCOPE_API_KEY;
  const previousBase = process.env.DASHSCOPE_BASE_URL;
  const previousFetch = global.fetch;
  process.env.DASHSCOPE_API_KEY = 'test-only-key';
  process.env.DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const service = new ManagedTemplatesService();
  service.getDraft = async () => ({ saved: true, revision: 'a'.repeat(64),
    testCases: [{ topic: '周末轻量露营', style: '真实' }],
    evaluation: { results: {} }, maxOutputTokens: 512, developerPrompt: '生成标题',
    outputSchema: defaultOutputSchema('XHS_TITLE') });
  try {
    global.fetch = async () => ({ ok: false, status: 400 });
    assert.deepEqual(await service.evaluateCase('XHS_TITLE', 'a'.repeat(64), 0),
      { kind: 'evaluation_failure', reason: 'http', status: 400 });
    global.fetch = async () => { throw new DOMException('timed out', 'TimeoutError'); };
    assert.deepEqual(await service.evaluateCase('XHS_TITLE', 'a'.repeat(64), 0),
      { kind: 'evaluation_failure', reason: 'timeout' });
    global.fetch = async () => { throw new TypeError('connection failed'); };
    assert.deepEqual(await service.evaluateCase('XHS_TITLE', 'a'.repeat(64), 0),
      { kind: 'evaluation_failure', reason: 'connection' });
    global.fetch = async () => ({ ok: true, json: async () => ({ choices: [{
      finish_reason: 'stop', message: { content: '{}' },
    }] }) });
    assert.equal((await service.evaluateCase('XHS_TITLE', 'a'.repeat(64), 0)).reason, 'schema');
    global.fetch = async () => ({ ok: true, json: async () => ({ choices: [{
      finish_reason: 'length', message: { content: '{"items":[' },
    }] }) });
    assert.deepEqual(await service.evaluateCase('XHS_TITLE', 'a'.repeat(64), 0),
      { kind: 'evaluation_failure', reason: 'finish', finishReason: 'length' });
    global.fetch = async () => ({ ok: true, json: async () => ({ choices: [{
      finish_reason: 'stop', message: { content: JSON.stringify({ items: Array.from({ length: 5 }, () =>
        ({ title: '10个露营技巧', angle: '场景型' })) }) },
    }] }) });
    assert.equal((await service.evaluateCase('XHS_TITLE', 'a'.repeat(64), 0)).reason, 'unsupported_number');

    const controller = new ManagedTemplatesController(
      { session: async () => ({ id: 'operator', role: 'operator' }) },
      { evaluateCase: async () => ({ kind: 'evaluation_failure', reason: 'http', status: 400 }) });
    const result = reply();
    await controller.test('XHS_TITLE', { revision: 'a'.repeat(64), index: 0 }, request, result);
    assert.equal(result.code, 502);
    assert.match(result.body.message, /HTTP 400/);
    const timeoutController = new ManagedTemplatesController(
      { session: async () => ({ id: 'operator', role: 'operator' }) },
      { evaluateCase: async () => ({ kind: 'evaluation_failure', reason: 'timeout' }) });
    const timedOut = reply();
    await timeoutController.test('THESIS_OUTLINE', { revision: 'a'.repeat(64), index: 3 }, request, timedOut);
    assert.equal(timedOut.code, 504);
    assert.match(timedOut.body.message, /超过 60 秒/);
  } finally {
    global.fetch = previousFetch;
    if (previousKey === undefined) delete process.env.DASHSCOPE_API_KEY;
    else process.env.DASHSCOPE_API_KEY = previousKey;
    if (previousBase === undefined) delete process.env.DASHSCOPE_BASE_URL;
    else process.env.DASHSCOPE_BASE_URL = previousBase;
    await service.onModuleDestroy();
  }
});

test('未经 20 条样本评估和人工审核的草稿不能发布', async () => {
  const service = new ManagedTemplatesService();
  const statements = [];
  service.pool.connect = async () => ({
    query: async (sql) => {
      statements.push(sql);
      if (sql.includes('FROM templates t')) return { rows: [{ id: 'template-id', code: 'XHS_SCRIPT',
        name: '脚本', description: '说明', status: 'disabled', current_version_id: null, current_version: null }] };
      if (sql.includes("status = 'draft'")) return { rows: [{ id: 'draft-id', version: 1,
        status: 'draft', developer_prompt: '生成脚本', change_log: '初稿',
        form_schema: defaultFormSchema('XHS_SCRIPT'), output_schema: defaultOutputSchema('XHS_SCRIPT'),
        model_config: { description: '说明', maxTokens: 512, testCases: [], evaluation: { results: {} } } }] };
      return { rows: [] };
    }, release: () => {},
  });
  try {
    const draft = await service.getDraft('XHS_SCRIPT');
    const result = await service.publishDraft('XHS_SCRIPT', draft.revision, 'admin-id', 'request-id', '127.0.0.1');
    assert.equal(result, 'invalid');
    assert.equal(statements.some((sql) => sql.startsWith('UPDATE template_versions')), false);
  } finally { await service.onModuleDestroy(); }
});

test('20 条测试通过后，审核与发布在事务内保留结果并写审计', async () => {
  const previousKey = process.env.DASHSCOPE_API_KEY;
  const previousModel = process.env.DASHSCOPE_MODEL;
  process.env.DASHSCOPE_API_KEY = 'test-only-key';
  process.env.DASHSCOPE_MODEL = 'qwen-plus';
  const service = new ManagedTemplatesService();
  const statements = [];
  const testCases = Array.from({ length: 20 }, (_, index) => ({ topic: `主题${index}` }));
  let draft = { id: 'draft-id', version: 1, status: 'draft', developer_prompt: '生成内容',
    change_log: '初稿', form_schema: defaultFormSchema('XHS_SCRIPT'),
    output_schema: defaultOutputSchema('XHS_SCRIPT'),
    model_config: { description: '说明', maxTokens: 512, testCases,
      evaluation: { results: Object.fromEntries(testCases.map((_, index) =>
        [String(index), { passed: true, output: {}, model: 'qwen-plus', durationMs: 10 }])) } } };
  service.pool.connect = async () => ({
    query: async (sql, params) => {
      statements.push({ sql, params });
      if (sql.includes('FROM templates t')) return { rows: [{ id: 'template-id', code: 'XHS_SCRIPT',
        name: '脚本', description: '旧说明', status: 'disabled', current_version_id: null, current_version: null }] };
      if (sql.includes("status = 'draft'") && sql.startsWith('SELECT')) return { rows: [draft] };
      if (sql.startsWith('UPDATE template_versions SET model_config')) {
        draft = { ...draft, model_config: JSON.parse(params[1]) };
        return { rows: [draft] };
      }
      if (sql.startsWith('UPDATE template_versions SET status')) return { rows: [{ published_at: new Date('2026-10-22T00:00:00.000Z') }] };
      return { rows: [] };
    }, release: () => {},
  });
  try {
    const loaded = await service.getDraft('XHS_SCRIPT');
    const reviewed = await service.reviewDraft('XHS_SCRIPT', loaded.revision, '人工检查内容合规',
      'admin-id', 'request-id', '127.0.0.1');
    assert.equal(reviewed.evaluation.approvedBy, 'admin-id');
    const published = await service.publishDraft('XHS_SCRIPT', loaded.revision,
      'admin-id', 'request-id', '127.0.0.1');
    assert.equal(published.status, 'active');
    assert.equal(statements.filter((item) => item.sql.includes('INSERT INTO admin_audit_logs')).length, 2);
    const liveUpdate = statements.find((item) => item.sql.startsWith('UPDATE templates'));
    assert.equal(liveUpdate.params[2], '说明');
    assert.equal(statements.filter((item) => item.sql === 'COMMIT').length, 2);
  } finally {
    await service.onModuleDestroy();
    if (previousKey === undefined) delete process.env.DASHSCOPE_API_KEY;
    else process.env.DASHSCOPE_API_KEY = previousKey;
    if (previousModel === undefined) delete process.env.DASHSCOPE_MODEL;
    else process.env.DASHSCOPE_MODEL = previousModel;
  }
});

test('通用回滚保留下架状态、记录原因并只切换版本指针', async () => {
  const service = new ManagedTemplatesService();
  const statements = [];
  service.pool.connect = async () => ({
    query: async (sql, params) => {
      statements.push({ sql, params });
      if (sql.includes('FROM templates t')) return { rows: [{ id: 'template-id', code: 'XHS_SCRIPT',
        name: '脚本', description: '当前说明', status: 'disabled', current_version_id: 'v2', current_version: 2 }] };
      if (sql.includes('JOIN template_versions v')) return { rows: [{ id: 'v2', status: 'published' }] };
      if (sql.includes('FROM template_versions WHERE template_id')) return { rows: [{ id: 'v1',
        version: 1, model_config: { description: '旧版说明' } }] };
      if (sql.startsWith('UPDATE templates')) return { rows: [{ updated_at: new Date('2026-10-22T00:00:00.000Z') }] };
      return { rows: [] };
    }, release: () => {},
  });
  try {
    const result = await service.auditAction('XHS_SCRIPT', 'rollback', {
      expectedStatus: 'disabled', expectedCurrentVersion: 2, targetVersion: 1,
      reason: '新版结果质量下降' }, 'admin-id', 'request-id', '127.0.0.1');
    assert.equal(result.status, 'disabled');
    assert.equal(result.currentVersion, 1);
    const update = statements.find((item) => item.sql.startsWith('UPDATE templates'));
    assert.match(update.sql, /current_version_id/);
    assert.doesNotMatch(update.sql, /status =/);
    assert.equal(update.params[2], '旧版说明');
    const audit = statements.find((item) => item.sql.includes('INSERT INTO admin_audit_logs'));
    assert.equal(JSON.parse(audit.params[6]).reason, '新版结果质量下降');
  } finally { await service.onModuleDestroy(); }
});
