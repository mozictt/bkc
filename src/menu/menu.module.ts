import { Module } from '@nestjs/common';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Menu } from '@entities/menu.entity';
import { Role } from '@src/role/entities/role.entity';
import { Tenant } from '../entities/tenant.entity';
import { RoleMenuPermission } from '@entities//role-menu-permissions.entity';
import { TenantContextService } from '@common/tenant/tenant-context.service';

import { DiscoveryModule } from '@nestjs/core';
import { PermissionSeederService } from './permission-seeder.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Menu, Role, Tenant, RoleMenuPermission]),
    DiscoveryModule,
  ],
  controllers: [MenuController],
  providers: [MenuService, TenantContextService, PermissionSeederService],
})
export class MenuModule {}
