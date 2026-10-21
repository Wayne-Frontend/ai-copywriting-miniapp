import { Body, Controller, Get, Put, Req, Res } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AdminAuthService, type AdminIdentity } from './admin-auth.service';
import { AdminTemplatesService, type AdminTemplateDraft, type AdminTemplateListItem } from './admin-templates.service';

const COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-admin_session' : 'admin_session';

interface AdminRequest { cookies: Record<string, string | undefined> }
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
}
