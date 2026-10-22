const { afterEach, test } = require('node:test');
const assert = require('node:assert/strict');
const {
  BailianTemplateTestService,
  BailianTestError,
  parseXhsTitleOutput,
  parseXhsTitleTestRequest,
} = require('../dist/bailian-template-test.service.js');

const previousFetch = global.fetch;
const previousKey = process.env.DASHSCOPE_API_KEY;
const previousUrl = process.env.DASHSCOPE_BASE_URL;
const previousModel = process.env.DASHSCOPE_MODEL;

afterEach(() => {
  global.fetch = previousFetch;
  if (previousKey === undefined) delete process.env.DASHSCOPE_API_KEY;
  else process.env.DASHSCOPE_API_KEY = previousKey;
  if (previousUrl === undefined) delete process.env.DASHSCOPE_BASE_URL;
  else process.env.DASHSCOPE_BASE_URL = previousUrl;
  if (previousModel === undefined) delete process.env.DASHSCOPE_MODEL;
  else process.env.DASHSCOPE_MODEL = previousModel;
});

const draft = {
  version: 1,
  revision: 'a'.repeat(64),
  developerPrompt: '生成五个不同角度的标题，只输出 JSON。',
};
const inputs = { topic: '周末露营', style: '真实' };

test('测试请求拒绝越界字段，输出解析要求恰好五条 title/angle', () => {
  assert.equal(parseXhsTitleTestRequest({ revision: draft.revision, inputs: { ...inputs, extra: 'x' } }), null);
  assert.deepEqual(parseXhsTitleTestRequest({ revision: draft.revision, inputs }), {
    revision: draft.revision,
    inputs,
  });
  assert.equal(parseXhsTitleOutput(JSON.stringify({ items: [{ title: '标题', angle: '场景型' }] })), null);
  assert.equal(parseXhsTitleOutput(JSON.stringify({ items: Array.from({ length: 5 }, () => ({ title: '', angle: '场景型' })) })), null);
});

test('通过服务端请求百炼并返回经过校验的五条标题和 Token 用量', async () => {
  process.env.DASHSCOPE_API_KEY = 'test-key';
  delete process.env.DASHSCOPE_BASE_URL;
  delete process.env.DASHSCOPE_MODEL;
  let providerRequest;
  global.fetch = async (url, options) => {
    providerRequest = { url: String(url), options };
    return new Response(JSON.stringify({
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
        items: ['场景', '建议', '问答', '清单', '提醒'].map((word) => ({ title: `${word}标题`, angle: '场景型' })),
      }) } }],
      usage: { prompt_tokens: 123, completion_tokens: 45, total_tokens: 168 },
    }), { status: 200 });
  };

  const result = await new BailianTemplateTestService().testXhsTitle(draft, inputs);
  assert.equal(result.items.length, 5);
  assert.deepEqual(result.tokenUsage, { input: 123, output: 45, total: 168 });
  assert.equal(result.version, draft.version);
  assert.equal(providerRequest.url, 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions');
  assert.equal(providerRequest.options.headers.Authorization, 'Bearer test-key');
  const body = JSON.parse(providerRequest.options.body);
  assert.equal(body.model, 'qwen-plus');
  assert.deepEqual(body.response_format, { type: 'json_object' });
  assert.equal(body.messages[1].content, draft.developerPrompt);
});

test('百炼返回不符合契约的数据时拒绝作为成功结果', async () => {
  process.env.DASHSCOPE_API_KEY = 'test-key';
  delete process.env.DASHSCOPE_BASE_URL;
  global.fetch = async () => new Response(JSON.stringify({
    choices: [{ finish_reason: 'stop', message: { content: '{"items":[]}' } }],
  }), { status: 200 });
  await assert.rejects(new BailianTemplateTestService().testXhsTitle(draft, inputs),
    (error) => error instanceof BailianTestError && error.code === 'AI_SERVICE_ERROR');
});

test('拒绝模型自行添加的价格和数量', async () => {
  process.env.DASHSCOPE_API_KEY = 'test-key';
  delete process.env.DASHSCOPE_BASE_URL;
  global.fetch = async () => new Response(JSON.stringify({
    choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
      items: Array.from({ length: 5 }, (_, index) => ({
        title: index === 0 ? '500元搞定周末露营' : '周末露营建议',
        angle: '建议型',
      })),
    }) } }],
  }), { status: 200 });
  await assert.rejects(new BailianTemplateTestService().testXhsTitle(draft, inputs),
    (error) => error instanceof BailianTestError && error.message.includes('输入未提供的数字或个人经历'));
});

test('未提供个人经历时拒绝第一人称标题', async () => {
  process.env.DASHSCOPE_API_KEY = 'test-key';
  delete process.env.DASHSCOPE_BASE_URL;
  let calls = 0;
  global.fetch = async () => {
    calls++;
    return new Response(JSON.stringify({
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
        items: Array.from({ length: 5 }, () => ({ title: '我的首次露营实测', angle: '经验型' })),
      }) } }],
    }), { status: 200 });
  };
  await assert.rejects(new BailianTemplateTestService().testXhsTitle(draft, inputs),
    (error) => error instanceof BailianTestError && error.message.includes('个人经历'));
  assert.equal(calls, 2);
});

test('新增数字时只重试一次并合并两次 Token 用量', async () => {
  process.env.DASHSCOPE_API_KEY = 'test-key';
  delete process.env.DASHSCOPE_BASE_URL;
  let calls = 0;
  global.fetch = async (_url, options) => {
    calls++;
    if (calls === 2) {
      const request = JSON.parse(options.body);
      assert.match(request.messages[2].content, /500元搞定露营/);
    }
    return new Response(JSON.stringify({
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
        items: Array.from({ length: 5 }, () => ({
          title: calls === 1 ? '500元搞定露营' : '适合新手的周末露营清单',
          angle: '建议型',
        })),
      }) } }],
      usage: { prompt_tokens: 100, completion_tokens: 40, total_tokens: 140 },
    }), { status: 200 });
  };
  const result = await new BailianTemplateTestService().testXhsTitle(draft, inputs);
  assert.equal(calls, 2);
  assert.equal(result.items[0].title, '适合新手的周末露营清单');
  assert.deepEqual(result.tokenUsage, { input: 200, output: 80, total: 280 });
});

test('未配置密钥或配置了非百炼地址时不会发出请求', async () => {
  let called = false;
  global.fetch = async () => { called = true; throw new Error('unexpected'); };
  delete process.env.DASHSCOPE_API_KEY;
  await assert.rejects(new BailianTemplateTestService().testXhsTitle(draft, inputs),
    (error) => error instanceof BailianTestError && error.status === 503);
  process.env.DASHSCOPE_API_KEY = 'test-key';
  process.env.DASHSCOPE_BASE_URL = 'https://example.com/compatible-mode/v1';
  await assert.rejects(new BailianTemplateTestService().testXhsTitle(draft, inputs),
    (error) => error instanceof BailianTestError && error.status === 503);
  assert.equal(called, false);
});
