import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../entities/tenant.entity';
import { TenantsService } from './tenants.service';
import { TenantSettingsService } from './tenant-settings.service';
import { TenantsController } from './tenants.controller';
import { TenantSettingsController } from './tenant-settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  controllers: [TenantSettingsController, TenantsController],
  providers: [TenantsService, TenantSettingsService],
  exports: [TenantsService, TenantSettingsService],
})
export class TenantsModule {}
