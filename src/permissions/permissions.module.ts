import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from '@entities/permission.entity';
import { Menu } from '@entities/menu.entity';
import { PermissionService } from './permission.service';
import { PermissionGuard } from './guards/permission.guard';
import { PermissionsController } from './permissions.controller';

@Global() // Jadikan Global agar gampang dipakai di mana saja tanpa import
@Module({
  imports: [TypeOrmModule.forFeature([Permission, Menu])],
  controllers: [PermissionsController],
  providers: [PermissionService, PermissionGuard],
  exports: [PermissionService, PermissionGuard],
})
export class PermissionsModule {}
