import { Module } from '@nestjs/common';
import { MenuService } from './menu.service';
import { MenuController } from './menu.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Menu } from '@entities/menu.entity';
import { Role } from '@src/role/entities/role.entity';
import { Tenant } from '../entities/tenant.entity';
import { Permission } from '@entities/permission.entity';
import { TenantContextService } from '@common/tenant/tenant-context.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Menu, Role, Tenant, Permission]),
  ],
  controllers: [MenuController],
  providers: [MenuService, TenantContextService],
  exports: [MenuService],
})
export class MenuModule {}
