import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AdminAuthService, type AdminIdentity } from './admin-auth.service';
import { AdminUserError, AdminUsersService, parseProfile, type AdminRole } from './admin-users.service';

const COOKIE = process.env.NODE_ENV === 'production' ? '__Host-admin_session' : 'admin_session';
interface Request { cookies: Record<string, string | undefined>; ip: string }
interface Reply { status(code: number): Reply; send(body: unknown): void; header(name: string, value: string): Reply }
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function exact(body: unknown, keys: string[]): body is Record<string, unknown> {
  return isObject(body) && Object.keys(body).sort().join(',') === keys.sort().join(',');
}
function fail(reply: Reply, status: number, code: string, message: string, requestId: string) {
  reply.status(status).send({ code, message, details: null, requestId });
}

@Controller('api/admin/v1/admin-users')
export class AdminUsersController {
  constructor(private readonly auth: AdminAuthService, private readonly users: AdminUsersService) {}
  private async run<T>(request: Request, reply: Reply, action: (actor: AdminIdentity, id: string) => Promise<T>) {
    const id = randomUUID();
    reply.header('Cache-Control', 'no-store');
    try {
      const actor = await this.auth.session(request.cookies[COOKIE]);
      if (!actor) { fail(reply, 401, 'AUTH_REQUIRED', '管理会话已失效，请重新登录', id); return; }
      if (actor.role !== 'super_admin') { fail(reply, 403, 'PERMISSION_DENIED', '只有超级管理员可以管理账号', id); return; }
      return { code: 'OK' as const, message: 'ok', data: await action(actor, id), requestId: id };
    } catch (error) {
      if (error instanceof AdminUserError) fail(reply, error.status, error.code, error.message, id);
      else fail(reply, 503, 'SERVICE_UNAVAILABLE', '管理员服务暂时不可用', id);
    }
  }
  @Get()
  list(@Query() query: Record<string, unknown>, @Req() request: Request, @Res({ passthrough: true }) reply: Reply) {
    return this.run(request, reply, () => this.users.list(query));
  }
  @Post()
  @HttpCode(200)
  create(@Body() body: unknown, @Req() request: Request, @Res({ passthrough: true }) reply: Reply) {
    return this.run(request, reply, (actor, id) => {
      if (!exact(body, ['username', 'password', 'role', 'profile']) ||
        typeof body.username !== 'string' || typeof body.password !== 'string' ||
        (body.role !== 'super_admin' && body.role !== 'operator')) {
        throw new AdminUserError(400, 'VALIDATION_ERROR', '账号参数不正确');
      }
      return this.users.create({ username: body.username, password: body.password,
        role: body.role as AdminRole, profile: parseProfile(body.profile) }, actor.id, id, request.ip);
    });
  }
  @Patch(':id/profile')
  profile(@Param('id') userId: string, @Body() body: unknown,
    @Req() request: Request, @Res({ passthrough: true }) reply: Reply) {
    return this.run(request, reply, (actor, id) => this.users.updateProfile(
      userId, parseProfile(body), actor.id, id, request.ip));
  }
  @Patch(':id/access')
  access(@Param('id') userId: string, @Body() body: unknown,
    @Req() request: Request, @Res({ passthrough: true }) reply: Reply) {
    return this.run(request, reply, (actor, id) => {
      if (!exact(body, ['role', 'status']) ||
        (body.role !== 'super_admin' && body.role !== 'operator') ||
        (body.status !== 'active' && body.status !== 'disabled')) {
        throw new AdminUserError(400, 'VALIDATION_ERROR', '角色或状态不正确');
      }
      return this.users.changeAccess(userId, body.role, body.status, actor.id, id, request.ip);
    });
  }
  @Post(':id/password/reset')
  @HttpCode(200)
  resetPassword(@Param('id') userId: string, @Body() body: unknown,
    @Req() request: Request, @Res({ passthrough: true }) reply: Reply) {
    return this.run(request, reply, async (actor, id) => {
      if (!exact(body, ['password']) || typeof body.password !== 'string') {
        throw new AdminUserError(400, 'VALIDATION_ERROR', '密码参数不正确');
      }
      await this.users.resetPassword(userId, body.password, actor.id, id, request.ip);
      return null;
    });
  }
  @Post(':id/mfa/reset')
  @HttpCode(200)
  resetMfa(@Param('id') userId: string, @Req() request: Request, @Res({ passthrough: true }) reply: Reply) {
    return this.run(request, reply, (actor, id) => this.users.resetMfa(userId, actor.id, id, request.ip));
  }
  @Post(':id/mfa/confirm')
  @HttpCode(200)
  confirmMfa(@Param('id') userId: string, @Body() body: unknown,
    @Req() request: Request, @Res({ passthrough: true }) reply: Reply) {
    return this.run(request, reply, (actor, id) => {
      if (!exact(body, ['token']) || typeof body.token !== 'string') {
        throw new AdminUserError(400, 'VALIDATION_ERROR', '验证码参数不正确');
      }
      return this.users.confirmMfa(userId, body.token, actor.id, id, request.ip);
    });
  }
}
