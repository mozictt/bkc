import { Module } from '@nestjs/common';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Menu } from '@entities/menu.entity';
import { Role } from '@entities/role.entity';
import { Tenant } from '../entities/tenant.entity';
import { RoleMenuPermission } from '@entities//role-menu-permissions.entity';
import { TenantContextService } from '@common/tenant/tenant-context.service';

@Module({
  imports: [TypeOrmModule.forFeature([Menu, Role, Tenant, RoleMenuPermission])],
  controllers: [MenuController],
  providers: [MenuService, TenantContextService],
})
export class MenuModule {}
