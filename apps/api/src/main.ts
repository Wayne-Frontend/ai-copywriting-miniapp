import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import cookie from '@fastify/cookie';
import csrfProtection from '@fastify/csrf-protection';
import { randomUUID } from 'node:crypto';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  await app.register(cookie);
  await app.register(csrfProtection, {
    cookieKey: process.env.NODE_ENV === 'production' ? '__Host-admin_csrf' : 'admin_csrf',
    cookieOpts: {
      path: '/', httpOnly: true, sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    },
    getToken: (request) => request.headers['x-csrf-token'] as string | undefined,
  });
  const fastify = app.getHttpAdapter().getInstance();
  fastify.addHook('onSend', (request, reply, payload, done) => {
    if (request.url.startsWith('/api/admin/v1/') && reply.statusCode === 403 &&
      /Missing csrf secret|Invalid csrf token/.test(String(payload))) {
      reply.header('content-type', 'application/json; charset=utf-8');
      done(null, JSON.stringify({ code: 'PERMISSION_DENIED', message: 'CSRF 校验失败',
        details: null, requestId: randomUUID() }));
      return;
    }
    done(null, payload);
  });
  fastify.addHook('onRequest', (request, reply, done) => {
    // 管理端所有写操作统一验 CSRF，后续新增接口不会漏掉保护。
    if (request.url.startsWith('/api/admin/v1/') &&
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      fastify.csrfProtection(request, reply, done);
      return;
    }
    done();
  });
  app.enableShutdownHooks();
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '127.0.0.1');
}

bootstrap().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
