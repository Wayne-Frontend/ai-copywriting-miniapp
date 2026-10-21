import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';

@Injectable()
export class DatabaseHealthService implements OnModuleDestroy {
  private readonly pool: Pool | null;

  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    this.pool = databaseUrl
      ? new Pool({ connectionString: databaseUrl, max: 1, connectionTimeoutMillis: 2000 })
      : null;
  }

  async isReady(): Promise<boolean> {
    if (!this.pool) return false;

    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      // 就绪检查只返回可用性，不把连接错误或凭据暴露给调用方。
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }
}
