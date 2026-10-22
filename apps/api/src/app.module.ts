import { Module } from '@nestjs/common';
import { DatabaseHealthService } from './database-health.service';
import { HealthController } from './health.controller';
import { AdminAuthController } from './admin-auth.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminTemplatesController } from './admin-templates.controller';
import { AdminTemplatesService } from './admin-templates.service';
import { BailianTemplateTestService } from './bailian-template-test.service';
import { ManagedTemplatesController } from './managed-templates.controller';
import { ManagedTemplatesService } from './managed-templates.service';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

@Module({
  controllers: [HealthController, AdminAuthController, AdminUsersController,
    AdminTemplatesController, ManagedTemplatesController],
  providers: [DatabaseHealthService, AdminAuthService, AdminTemplatesService, BailianTemplateTestService,
    ManagedTemplatesService, AdminUsersService],
})
export class AppModule {}
