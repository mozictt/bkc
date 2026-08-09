import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permission } from '@entities/permission.entity';
import { PermissionService } from './permission.service';
import { PermissionGuard } from './guards/permission.guard';

@Global() // Jadikan Global agar gampang dipakai di mana saja tanpa import
@Module({
  imports: [TypeOrmModule.forFeature([Permission])],
  providers: [PermissionService, PermissionGuard],
  exports: [PermissionService, PermissionGuard],
})
export class PermissionsModule {}
