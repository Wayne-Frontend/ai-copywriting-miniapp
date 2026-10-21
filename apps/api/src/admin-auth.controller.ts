import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AdminAuthService, type AdminIdentity } from './admin-auth.service';

const COOKIE_NAME = process.env.NODE_ENV === 'production' ? '__Host-admin_session' : 'admin_session';
const SECURE_COOKIE = process.env.NODE_ENV === 'production';

interface LoginBody { username?: unknown; password?: unknown; totp?: unknown }
interface Envelope<T> { code: 'OK'; message: string; data: T; requestId: string }
interface AdminRequest { ip: string; cookies: Record<string, string | undefined> }
interface AdminReply {
  status(code: number): AdminReply;
  send(body: unknown): void;
  header(name: string, value: string): AdminReply;
  generateCsrf(): string;
  setCookie(name: string, value: string, options: Record<string, unknown>): AdminReply;
  clearCookie(name: string, options: Record<string, unknown>): AdminReply;
}

function success<T>(data: T, requestId: string): Envelope<T> {
  return { code: 'OK', message: 'ok', data, requestId };
}

function failure(reply: AdminReply, status: number, code: string, message: string, requestId: string): void {
  reply.status(status).send({ code, message, details: null, requestId });
}

@Controller('api/admin/v1/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Get('csrf')
  csrf(@Res({ passthrough: true }) reply: AdminReply): Envelope<{ csrfToken: string }> {
    reply.header('Cache-Control', 'no-store');
    return success({ csrfToken: reply.generateCsrf() }, randomUUID());
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: LoginBody,
    @Req() request: AdminRequest,
    @Res({ passthrough: true }) reply: AdminReply,
  ): Promise<Envelope<{ admin: AdminIdentity }> | void> {
    const requestId = randomUUID();
    if (!body || typeof body.username !== 'string' || typeof body.password !== 'string' ||
      typeof body.totp !== 'string' || body.username.length > 80 || !body.username.trim() ||
      body.password.length < 1 || body.password.length > 1024 || !/^\d{6}$/.test(body.totp)) {
      failure(reply, 400, 'VALIDATION_ERROR', '登录参数格式不正确', requestId);
      return;
    }
    let result: Awaited<ReturnType<AdminAuthService['login']>>;
    try {
      result = await this.auth.login(body.username, body.password, body.totp, request.ip);
    } catch {
      failure(reply, 503, 'SERVICE_UNAVAILABLE', '登录服务暂时不可用', requestId);
      return;
    }
    if (result === 'limited') {
      failure(reply, 429, 'RATE_LIMITED', '登录尝试过多，请稍后再试', requestId);
      return;
    }
    if (result === 'invalid') {
      failure(reply, 401, 'AUTH_REQUIRED', '用户名、密码或验证码错误', requestId);
      return;
    }
    reply.setCookie(COOKIE_NAME, result.token, {
      path: '/', httpOnly: true, secure: SECURE_COOKIE, sameSite: 'strict',
      maxAge: this.auth.sessionSeconds,
    });
    reply.header('Cache-Control', 'no-store');
    return success({ admin: result.identity }, requestId);
  }

  @Get('me')
  async me(@Req() request: AdminRequest, @Res({ passthrough: true }) reply: AdminReply): Promise<Envelope<{ admin: AdminIdentity }> | void> {
    const requestId = randomUUID();
    let identity: AdminIdentity | null;
    try {
      identity = await this.auth.session(request.cookies[COOKIE_NAME]);
    } catch {
      failure(reply, 503, 'SERVICE_UNAVAILABLE', '会话服务暂时不可用', requestId);
      return;
    }
    reply.header('Cache-Control', 'no-store');
    if (!identity) {
      failure(reply, 401, 'AUTH_REQUIRED', '管理会话已失效，请重新登录', requestId);
      return;
    }
    return success({ admin: identity }, requestId);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() request: AdminRequest, @Res({ passthrough: true }) reply: AdminReply): Promise<Envelope<null> | void> {
    try {
      await this.auth.logout(request.cookies[COOKIE_NAME]);
    } catch {
      failure(reply, 503, 'SERVICE_UNAVAILABLE', '会话服务暂时不可用', randomUUID());
      return;
    }
    reply.clearCookie(COOKIE_NAME, { path: '/' });
    reply.header('Cache-Control', 'no-store');
    return success(null, randomUUID());
  }
}
