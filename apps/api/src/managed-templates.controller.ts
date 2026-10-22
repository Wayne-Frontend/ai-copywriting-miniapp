import { Body, Controller, Get, Param, Patch, Post, Put, Req, Res } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AdminAuthService, type AdminIdentity } from './admin-auth.service';
import { ManagedTemplatesService, type ManagedDraftInput } from './managed-templates.service';
import { managedTemplateCode, type ManagedTemplateCode } from './template-definitions';
import { record } from './template-schema';

const COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-admin_session' : 'admin_session';
interface Request { cookies: Record<string, string | undefined>; ip: string }
interface Reply { status(code: number): Reply; send(body: unknown): void; header(name: string, value: string): Reply }
function fail(reply: Reply, status: number, code: string, message: string, id: string): void {
  reply.status(status).send({ code, message, details: null, requestId: id });
}
function response(data: unknown, requestId: string) { return { code: 'OK' as const, message: 'ok', data, requestId }; }
function versionNumber(value: string): number | null {
  const number = Number(value);
  return /^\d+$/.test(value) && Number.isSafeInteger(number) && number > 0 ? number : null;
}

@Controller('api/admin/v1/managed-templates')
export class ManagedTemplatesController {
  constructor(private readonly auth: AdminAuthService, private readonly templates: ManagedTemplatesService) {}
  private async authorize(request: Request, reply: Reply, id: string, superOnly = false): Promise<AdminIdentity | null> {
    let identity: AdminIdentity | null;
    try { identity = await this.auth.session(request.cookies[COOKIE_NAME]); }
    catch { fail(reply, 503, 'SERVICE_UNAVAILABLE', '会话服务暂时不可用', id); return null; }
    if (!identity) { fail(reply, 401, 'AUTH_REQUIRED', '管理会话已失效，请重新登录', id); return null; }
    if (identity.role !== 'super_admin' && (superOnly || identity.role !== 'operator')) {
      fail(reply, 403, 'PERMISSION_DENIED', '无权执行模板操作', id); return null;
    }
    return identity;
  }
  private code(value: string, reply: Reply, id: string): ManagedTemplateCode | null {
    if (!managedTemplateCode(value)) {
      fail(reply, 404, 'NOT_FOUND', '模板不存在', id); return null;
    }
    return value;
  }
  private handle(reply: Reply, id: string, result: unknown): ReturnType<typeof response> | void {
    if (result === 'not_found') { fail(reply, 404, 'NOT_FOUND', '模板或版本不存在', id); return; }
    if (result === 'conflict') { fail(reply, 409, 'CONFLICT', '模板已被其他管理员修改，请刷新后重试', id); return; }
    if (result === 'invalid') { fail(reply, 400, 'VALIDATION_ERROR', '模板配置、测试集或审核状态不符合要求', id); return; }
    return response(result, id);
  }

  @Get(':code/draft')
  async draft(@Param('code') raw: string, @Req() request: Request, @Res({ passthrough: true }) reply: Reply) {
    const id = randomUUID(); reply.header('Cache-Control', 'no-store');
    if (!await this.authorize(request, reply, id)) return;
    const code = this.code(raw, reply, id); if (!code) return;
    try { return this.handle(reply, id, await this.templates.getDraft(code) ?? 'not_found'); }
    catch { fail(reply, 503, 'SERVICE_UNAVAILABLE', '模板草稿暂时不可用', id); }
  }

  @Put(':code/draft')
  async save(@Param('code') raw: string, @Body() body: unknown,
    @Req() request: Request, @Res({ passthrough: true }) reply: Reply) {
    const id = randomUUID(); reply.header('Cache-Control', 'no-store');
    const identity = await this.authorize(request, reply, id); if (!identity) return;
    const code = this.code(raw, reply, id); if (!code) return;
    if (!record(body) || Object.keys(body).sort().join(',') !==
      'changeLog,description,developerPrompt,formSchema,maxOutputTokens,outputSchema,revision,testCases') {
      fail(reply, 400, 'VALIDATION_ERROR', '草稿参数不完整', id); return;
    }
    try { return this.handle(reply, id, await this.templates.saveDraft(code, body as unknown as ManagedDraftInput, identity.id)); }
    catch { fail(reply, 503, 'SERVICE_UNAVAILABLE', '保存草稿失败', id); }
  }

  @Post(':code/draft/test')
  async test(@Param('code') raw: string, @Body() body: unknown,
    @Req() request: Request, @Res({ passthrough: true }) reply: Reply) {
    const id = randomUUID(); reply.header('Cache-Control', 'no-store');
    if (!await this.authorize(request, reply, id)) return;
    const code = this.code(raw, reply, id); if (!code) return;
    if (!record(body) || Object.keys(body).sort().join(',') !== 'index,revision' ||
      typeof body.revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.revision) ||
      typeof body.index !== 'number' || !Number.isSafeInteger(body.index)) {
      fail(reply, 400, 'VALIDATION_ERROR', '测试参数不正确', id); return;
    }
    try {
      const result = await this.templates.evaluateCase(code, body.revision, body.index);
      if (typeof result === 'object' && result !== null && 'kind' in result &&
        result.kind === 'evaluation_failure') {
        const messages = {
          config: '百炼密钥或服务地址配置无效，请检查本地配置并重启 API',
          http: `百炼接口返回 HTTP ${result.status}，请检查模型、密钥、额度或服务状态`,
          timeout: '百炼响应超过 60 秒，本条测试已超时；请缩短输出或稍后重试',
          connection: '连接百炼服务失败，请检查网络或稍后重试',
          json: '模型未返回可解析的 JSON，请检查 Prompt 和输出限制',
          finish: `模型未正常完成生成（${result.finishReason}），请检查输出 Token 限制`,
          schema: '模型返回的 JSON 不符合当前模板的输出结构',
          unsupported_number: '标题包含输入中没有提供的数字，已拒绝本次结果',
          unsupported_experience: '标题包含输入中没有提供的个人经历，已拒绝本次结果',
        } as const;
        const status = result.reason === 'timeout' ? 504 :
          result.reason === 'http' || result.reason === 'connection' ? 502 : 400;
        fail(reply, status, 'AI_TEST_ERROR', messages[result.reason], id);
        return;
      }
      return this.handle(reply, id, result);
    }
    catch { fail(reply, 502, 'AI_SERVICE_ERROR', '模型测试失败，请检查百炼配置后重试', id); }
  }

  @Post(':code/draft/review')
  async review(@Param('code') raw: string, @Body() body: unknown,
    @Req() request: Request, @Res({ passthrough: true }) reply: Reply) {
    const id = randomUUID(); reply.header('Cache-Control', 'no-store');
    const identity = await this.authorize(request, reply, id, true); if (!identity) return;
    const code = this.code(raw, reply, id); if (!code) return;
    if (!record(body) || Object.keys(body).sort().join(',') !== 'note,revision' ||
      typeof body.note !== 'string' || !body.note.trim() || body.note.length > 1000 ||
      typeof body.revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.revision)) {
      fail(reply, 400, 'VALIDATION_ERROR', '审核说明或草稿版本不正确', id); return;
    }
    try { return this.handle(reply, id, await this.templates.reviewDraft(code, body.revision,
      body.note, identity.id, id, request.ip)); }
    catch { fail(reply, 503, 'SERVICE_UNAVAILABLE', '审核记录保存失败', id); }
  }

  @Post(':code/draft/publish')
  async publish(@Param('code') raw: string, @Body() body: unknown,
    @Req() request: Request, @Res({ passthrough: true }) reply: Reply) {
    const id = randomUUID(); reply.header('Cache-Control', 'no-store');
    const identity = await this.authorize(request, reply, id, true); if (!identity) return;
    const code = this.code(raw, reply, id); if (!code) return;
    if (!record(body) || Object.keys(body).length !== 1 ||
      typeof body.revision !== 'string' || !/^[a-f0-9]{64}$/.test(body.revision)) {
      fail(reply, 400, 'VALIDATION_ERROR', '草稿版本不正确', id); return;
    }
    try { return this.handle(reply, id, await this.templates.publishDraft(code, body.revision, identity.id, id, request.ip)); }
    catch { fail(reply, 503, 'SERVICE_UNAVAILABLE', '发布模板失败', id); }
  }

  @Get(':code/versions')
  async versions(@Param('code') raw: string, @Req() request: Request, @Res({ passthrough: true }) reply: Reply) {
    const id = randomUUID(); reply.header('Cache-Control', 'no-store');
    if (!await this.authorize(request, reply, id)) return;
    const code = this.code(raw, reply, id); if (!code) return;
    try { return this.handle(reply, id, await this.templates.versions(code) ?? 'not_found'); }
    catch { fail(reply, 503, 'SERVICE_UNAVAILABLE', '版本列表暂时不可用', id); }
  }

  @Get(':code/versions/:version')
  async version(@Param('code') raw: string, @Param('version') rawVersion: string,
    @Req() request: Request, @Res({ passthrough: true }) reply: Reply) {
    const id = randomUUID(); reply.header('Cache-Control', 'no-store');
    if (!await this.authorize(request, reply, id)) return;
    const code = this.code(raw, reply, id); if (!code) return;
    const number = versionNumber(rawVersion);
    if (!number) { fail(reply, 400, 'VALIDATION_ERROR', '版本号不正确', id); return; }
    try { return this.handle(reply, id, await this.templates.version(code, number) ?? 'not_found'); }
    catch { fail(reply, 503, 'SERVICE_UNAVAILABLE', '版本详情暂时不可用', id); }
  }

  @Patch(':code/availability')
  async availability(@Param('code') raw: string, @Body() body: unknown,
    @Req() request: Request, @Res({ passthrough: true }) reply: Reply) {
    const id = randomUUID(); reply.header('Cache-Control', 'no-store');
    const identity = await this.authorize(request, reply, id, true); if (!identity) return;
    const code = this.code(raw, reply, id); if (!code) return;
    if (!record(body) || Object.keys(body).sort().join(',') !== 'expectedCurrentVersion,expectedStatus,status' ||
      !['active', 'disabled'].includes(String(body.status)) ||
      !['active', 'disabled'].includes(String(body.expectedStatus)) ||
      !Number.isSafeInteger(body.expectedCurrentVersion) || Number(body.expectedCurrentVersion) < 1) {
      fail(reply, 400, 'VALIDATION_ERROR', '上下架参数不正确', id); return;
    }
    try { return this.handle(reply, id, await this.templates.auditAction(code, 'availability',
      body as { status: 'active' | 'disabled'; expectedStatus: 'active' | 'disabled'; expectedCurrentVersion: number },
      identity.id, id, request.ip)); }
    catch { fail(reply, 503, 'SERVICE_UNAVAILABLE', '上下架失败', id); }
  }

  @Post(':code/versions/:version/rollback')
  async rollback(@Param('code') raw: string, @Param('version') rawVersion: string,
    @Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) reply: Reply) {
    const id = randomUUID(); reply.header('Cache-Control', 'no-store');
    const identity = await this.authorize(request, reply, id, true); if (!identity) return;
    const code = this.code(raw, reply, id); if (!code) return;
    const targetVersion = versionNumber(rawVersion);
    if (!targetVersion || !record(body) ||
      Object.keys(body).sort().join(',') !== 'expectedCurrentVersion,expectedStatus,reason' ||
      !Number.isSafeInteger(body.expectedCurrentVersion) || Number(body.expectedCurrentVersion) < 1 ||
      !['active', 'disabled'].includes(String(body.expectedStatus)) ||
      typeof body.reason !== 'string' || !body.reason.trim() || body.reason.trim().length > 500) {
      fail(reply, 400, 'VALIDATION_ERROR', '回滚参数不正确', id); return;
    }
    try { return this.handle(reply, id, await this.templates.auditAction(code, 'rollback',
      { expectedCurrentVersion: body.expectedCurrentVersion as number,
        expectedStatus: body.expectedStatus as 'active' | 'disabled', targetVersion,
        reason: body.reason.trim() }, identity.id, id, request.ip)); }
    catch { fail(reply, 503, 'SERVICE_UNAVAILABLE', '版本回滚失败', id); }
  }
}
