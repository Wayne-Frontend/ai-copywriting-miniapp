import { Module } from '@nestjs/common';
import { DatabaseHealthService } from './database-health.service';
import { HealthController } from './health.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminTemplatesController } from './admin-templates.controller';
import { AdminTemplatesService } from './admin-templates.service';

@Module({
  controllers: [HealthController, AdminAuthController, AdminTemplatesController],
  providers: [DatabaseHealthService, AdminAuthService, AdminTemplatesService],
})
export class AppModule {}
