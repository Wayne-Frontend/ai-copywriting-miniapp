import { Body, Controller, Get, Param, Patch, Post, Put, Req, Res } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AdminAuthService, type AdminIdentity } from './admin-auth.service';
import { AdminTemplatesService, type ChangeTemplateAvailabilityResult, type AdminPublishedTemplateVersion,
  type AdminPublishedTemplateVersionDetail, type AdminTemplateDraft, type AdminTemplateListItem,
  type PublishTemplateResult, type RollbackTemplateVersionResult } from './admin-templates.service';
import { BailianTemplateTestService, BailianTestError, parseXhsTitleTestRequest,
  type XhsTitleTestResult } from './bailian-template-test.service';

const COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-admin_session' : 'admin_session';

interface AdminRequest { cookies: Record<string, string | undefined>; ip: string }
interface AdminReply {
  status(code: number): AdminReply;
  send(body: unknown): void;
  header(name: string, value: string): AdminReply;
}
interface DraftBody { developerPrompt?: unknown; changeLog?: unknown; revision?: unknown }
interface Envelope<T> { code: 'OK'; message: string; data: T; requestId: string }

function failure(reply: AdminReply, status: number, code: string, message: string, requestId: string): void {
  reply.status(status).send({ code, message, details: null, requestId });
}

@Controller('api/admin/v1/templates')
export class AdminTemplatesController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly templates: AdminTemplatesService,
    private readonly bailianTest: BailianTemplateTestService,
  ) {}

  private async authorize(request: AdminRequest, reply: AdminReply, requestId: string): Promise<AdminIdentity | null> {
    let identity: AdminIdentity | null;
    try {
      identity = await this.auth.session(request.cookies[COOKIE_NAME]);
    } catch {
      failure(reply, 503, 'SERVICE_UNAVAILABLE', '会话服务暂时不可用', requestId);
      return null;
    }
    if (!identity) {
      failure(reply, 401, 'AUTH_REQUIRED', '管理会话已失效，请重新登录', requestId);
      return null;
    }
    if (identity.role !== 'super_admin' && identity.role !== 'operator') {
      failure(reply, 403, 'PERMISSION_DENIED', '无权管理模板', requestId);
      return null;
    }
    return identity;
  }

  @Get()
  async list(
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) reply: AdminReply,
  ): Promise<Envelope<AdminTemplateListItem[]> | void> {
    const requestId = randomUUID();
    reply.header('Cache-Control', 'no-store');
    if (!await this.authorize(request, reply, requestId)) return;
    try {
      return { code: 'OK', message: 'ok', data: await this.templates.list(), requestId };
    } catch {
      failure(reply, 503, 'SERVICE_UNAVAILABLE', '模板列表暂时不可用', requestId);
    }
  }

  @Get('XHS_TITLE/draft')
  async xhsTitleDraft(@Req() request: AdminRequest, @Res({ passthrough: true }) reply: AdminReply): Promise<Envelope<AdminTemplateDraft> | void> {
    const requestId = randomUUID();
    reply.header('Cache-Control', 'no-store');
    if (!await this.authorize(request, reply, requestId)) return;
    try {
      const draft = await this.templates.getXhsTitleDraft();
      if (!draft) {
        failure(reply, 404, 'NOT_FOUND', '模板不存在', requestId);
        return;
      }
      return { code: 'OK', message: 'ok', data: draft, requestId };
    } catch {
      failure(reply, 503, 'SERVICE_UNAVAILABLE', '模板草稿暂时不可用', requestId);
    }
  }

  @Get('XHS_TITLE/versions')
  async xhsTitleVersions(
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) reply: AdminReply,
  ): Promise<Envelope<AdminPublishedTemplateVersion[]> | void> {
    const requestId = randomUUID();
    reply.header('Cache-Control', 'no-store');
    if (!await this.authorize(request, reply, requestId)) return;
    try {
      const versions = await this.templates.listXhsTitlePublishedVersions();
      if (!versions) {
        failure(reply, 404, 'NOT_FOUND', '模板不存在', requestId);
        return;
      }
      return { code: 'OK', message: 'ok', data: versions, requestId };
    } catch {
      failure(reply, 503, 'SERVICE_UNAVAILABLE', '模板版本列表暂时不可用', requestId);
    }
  }

  @Get('XHS_TITLE/versions/:version')
  async xhsTitleVersionDetail(
    @Param('version') version: string,
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) reply: AdminReply,
  ): Promise<Envelope<AdminPublishedTemplateVersionDetail> | void> {
    const requestId = randomUUID();
    reply.header('Cache-Control', 'no-store');
    if (!await this.authorize(request, reply, requestId)) return;
    const versionNumber = Number(version);
    if (!/^\d+$/.test(version) || !Number.isSafeInteger(versionNumber) || versionNumber < 1) {
      failure(reply, 400, 'VALIDATION_ERROR', '版本号不正确', requestId);
      return;
    }
    try {
      const detail = await this.templates.getXhsTitlePublishedVersion(versionNumber);
      if (!detail) {
        failure(reply, 404, 'NOT_FOUND', '已发布版本不存在', requestId);
        return;
      }
      return { code: 'OK', message: 'ok', data: detail, requestId };
    } catch {
      failure(reply, 503, 'SERVICE_UNAVAILABLE', '模板版本详情暂时不可用', requestId);
    }
  }

  @Post('XHS_TITLE/versions/:version/rollback')
  async rollbackXhsTitleVersion(
    @Param('version') version: string,
    @Body() body: unknown,
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) reply: AdminReply,
  ): Promise<Envelope<RollbackTemplateVersionResult> | void> {
    const requestId = randomUUID();
    reply.header('Cache-Control', 'no-store');
    const identity = await this.authorize(request, reply, requestId);
    if (!identity) return;
    if (identity.role !== 'super_admin') {
      failure(reply, 403, 'PERMISSION_DENIED', '只有超级管理员可以回滚模板版本', requestId);
      return;
    }
    const targetVersion = Number(version);
    if (!/^\d+$/.test(version) || !Number.isSafeInteger(targetVersion) || targetVersion < 1 ||
      !body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 3 ||
      !('expectedCurrentVersion' in body) || !('expectedStatus' in body) || !('reason' in body) ||
      typeof body.expectedCurrentVersion !== 'number' ||
      !Number.isSafeInteger(body.expectedCurrentVersion) || body.expectedCurrentVersion < 1 ||
      typeof body.expectedStatus !== 'string' ||
      !['active', 'disabled'].includes(body.expectedStatus) ||
      typeof body.reason !== 'string' || !body.reason.trim() || body.reason.trim().length > 500) {
      failure(reply, 400, 'VALIDATION_ERROR', '回滚目标或当前模板状态参数不正确', requestId);
      return;
    }
    try {
      const result = await this.templates.rollbackXhsTitleVersion(targetVersion, {
        expectedCurrentVersion: body.expectedCurrentVersion,
        expectedStatus: body.expectedStatus as 'active' | 'disabled',
        reason: body.reason.trim(),
      }, identity.id, requestId, request.ip);
      if (result === 'not_found') {
        failure(reply, 404, 'NOT_FOUND', '模板或目标已发布版本不存在', requestId);
        return;
      }
      if (result === 'conflict') {
        failure(reply, 409, 'CONFLICT', '当前模板状态或版本已变化，请刷新后重试', requestId);
        return;
      }
      if (result === 'invalid') {
        failure(reply, 400, 'VALIDATION_ERROR', '模板没有有效的当前已发布版本，无法回滚', requestId);
        return;
      }
      return { code: 'OK', message: 'ok', data: result, requestId };
    } catch {
      failure(reply, 503, 'SERVICE_UNAVAILABLE', '回滚模板版本失败', requestId);
    }
  }

  @Patch('XHS_TITLE/availability')
  async changeXhsTitleAvailability(
    @Body() body: unknown,
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) reply: AdminReply,
  ): Promise<Envelope<ChangeTemplateAvailabilityResult> | void> {
    const requestId = randomUUID();
    reply.header('Cache-Control', 'no-store');
    const identity = await this.authorize(request, reply, requestId);
    if (!identity) return;
    if (identity.role !== 'super_admin') {
      failure(reply, 403, 'PERMISSION_DENIED', '只有超级管理员可以上下架模板', requestId);
      return;
    }
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 3 ||
      !('status' in body) || !('expectedStatus' in body) || !('expectedVersion' in body) ||
      typeof body.status !== 'string' || !['active', 'disabled'].includes(body.status) ||
      typeof body.expectedStatus !== 'string' || !['active', 'disabled'].includes(body.expectedStatus) ||
      body.status === body.expectedStatus ||
      typeof body.expectedVersion !== 'number' ||
      !Number.isSafeInteger(body.expectedVersion) || body.expectedVersion < 1) {
      failure(reply, 400, 'VALIDATION_ERROR', '模板状态或版本参数不正确', requestId);
      return;
    }
    try {
      const result = await this.templates.changeXhsTitleAvailability({
        status: body.status as 'active' | 'disabled',
        expectedStatus: body.expectedStatus as 'active' | 'disabled',
        expectedVersion: body.expectedVersion,
      }, identity.id, requestId, request.ip);
      if (result === 'not_found') {
        failure(reply, 404, 'NOT_FOUND', '模板不存在', requestId);
        return;
      }
      if (result === 'conflict') {
        failure(reply, 409, 'CONFLICT', '模板状态或版本已变化，请刷新后重试', requestId);
        return;
      }
      if (result === 'invalid') {
        failure(reply, 400, 'VALIDATION_ERROR', '模板没有有效的已发布版本，无法上下架', requestId);
        return;
      }
      return { code: 'OK', message: 'ok', data: result, requestId };
    } catch {
      failure(reply, 503, 'SERVICE_UNAVAILABLE', '更新模板状态失败', requestId);
    }
  }

  @Put('XHS_TITLE/draft')
  async saveXhsTitleDraft(
    @Body() body: DraftBody,
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) reply: AdminReply,
  ): Promise<Envelope<AdminTemplateDraft> | void> {
    const requestId = randomUUID();
    reply.header('Cache-Control', 'no-store');
    const identity = await this.authorize(request, reply, requestId);
    if (!identity) return;
    if (!body || typeof body.developerPrompt !== 'string' || !body.developerPrompt.trim() ||
      body.developerPrompt.length > 10000 || typeof body.changeLog !== 'string' ||
      !body.changeLog.trim() || body.changeLog.length > 500 ||
      !(body.revision === null || (typeof body.revision === 'string' && /^[a-f0-9]{64}$/.test(body.revision)))) {
      failure(reply, 400, 'VALIDATION_ERROR', '草稿内容或版本标识不正确', requestId);
      return;
    }
    try {
      const draft = await this.templates.saveXhsTitleDraft({
        developerPrompt: body.developerPrompt,
        changeLog: body.changeLog,
        revision: body.revision,
      }, identity.id);
      if (draft === 'not_found') {
        failure(reply, 404, 'NOT_FOUND', '模板不存在', requestId);
        return;
      }
      if (draft === 'conflict') {
        failure(reply, 409, 'CONFLICT', '草稿已被其他管理员修改，请刷新后重试', requestId);
        return;
      }
      return { code: 'OK', message: 'ok', data: draft, requestId };
    } catch {
      failure(reply, 503, 'SERVICE_UNAVAILABLE', '保存草稿失败', requestId);
    }
  }

  @Post('XHS_TITLE/draft/test')
  async testXhsTitleDraft(
    @Body() body: unknown,
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) reply: AdminReply,
  ): Promise<Envelope<XhsTitleTestResult> | void> {
    const requestId = randomUUID();
    reply.header('Cache-Control', 'no-store');
    if (!await this.authorize(request, reply, requestId)) return;
    const input = parseXhsTitleTestRequest(body);
    if (!input) {
      failure(reply, 400, 'VALIDATION_ERROR', '测试输入不符合小红书标题模板字段规则', requestId);
      return;
    }
    let draft: AdminTemplateDraft | null;
    try {
      draft = await this.templates.getXhsTitleDraft();
    } catch {
      failure(reply, 503, 'SERVICE_UNAVAILABLE', '模板草稿暂时不可用', requestId);
      return;
    }
    if (!draft) {
      failure(reply, 404, 'NOT_FOUND', '模板不存在', requestId);
      return;
    }
    // 测试只读取已保存版本；版本变化后要求管理员刷新，避免把结果误认成当前编辑内容。
    if (!draft.saved || draft.revision !== input.revision) {
      failure(reply, 409, 'CONFLICT', '草稿未保存或已更新，请保存并刷新后重试', requestId);
      return;
    }
    try {
      return { code: 'OK', message: 'ok', data: await this.bailianTest.testXhsTitle(draft, input.inputs), requestId };
    } catch (error) {
      if (error instanceof BailianTestError) {
        failure(reply, error.status, error.code, error.message, requestId);
        return;
      }
      failure(reply, 502, 'AI_SERVICE_ERROR', '模型测试暂时不可用', requestId);
    }
  }

  @Post('XHS_TITLE/draft/publish')
  async publishXhsTitleDraft(
    @Body() body: unknown,
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) reply: AdminReply,
  ): Promise<Envelope<PublishTemplateResult> | void> {
    const requestId = randomUUID();
    reply.header('Cache-Control', 'no-store');
    const identity = await this.authorize(request, reply, requestId);
    if (!identity) return;
    if (identity.role !== 'super_admin') {
      failure(reply, 403, 'PERMISSION_DENIED', '只有超级管理员可以发布模板', requestId);
      return;
    }
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !('revision' in body) || typeof body.revision !== 'string' ||
      !/^[a-f0-9]{64}$/.test(body.revision)) {
      failure(reply, 400, 'VALIDATION_ERROR', '草稿版本标识不正确', requestId);
      return;
    }
    // 旧入口缺少测试集和人工审核状态，保留路由给旧页面显示明确迁移提示，禁止绕过新发布门槛。
    failure(reply, 409, 'CONFLICT', '请在新版模板配置页完成测试集评估和人工审核后发布', requestId);
  }
}
