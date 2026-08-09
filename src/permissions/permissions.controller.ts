import { Controller, Get, Put, Post, Delete, Body, Query, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { PermissionService } from './permission.service';
import { RequirePermission } from './decorators/require-permission.decorator';
import { UpdatePermissionByIdDto, SyncRolePermissionsDto } from './dto/update-permission.dto';
import { CopyRolePermissionsDto } from './dto/copy-permission.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from './guards/permission.guard';

@ApiTags('Permissions Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionService: PermissionService) {}

  @Get('resources')
  @RequirePermission('Permission', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar seluruh nama Resource Key unik (Format Select2 / Dropdown)',
    description: 'Mengembalikan daftar resource key dalam format objek { label, value, id, name } yang siap digunakan untuk komponen Select2 / Vue Select.',
  })
  @ApiQuery({
    name: 'format',
    required: false,
    type: String,
    description: 'Format output: "select" (bawaan: objek {label, value}) atau "array" (array string sederhana)',
    example: 'select',
  })
  @ApiResponse({
    status: 200,
    description: 'Berhasil mengambil daftar seluruh Resource Key.',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'OK',
        data: [
          { label: 'Menu', value: 'Menu', id: 'Menu', name: 'Menu' },
          { label: 'User', value: 'User', id: 'User', name: 'User' },
          { label: 'Role', value: 'Role', id: 'Role', name: 'Role' },
          { label: 'Barang', value: 'Barang', id: 'Barang', name: 'Barang' },
          { label: 'Gallery', value: 'Gallery', id: 'Gallery', name: 'Gallery' },
          { label: 'Album', value: 'Album', id: 'Album', name: 'Album' },
        ],
      },
    },
  })
  getAvailableResources(@Query('format') format?: string) {
    return this.permissionService.getAvailableResources(format);
  }

  @Get('resources/grouped')
  @RequirePermission('Permission', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar resource permissions yang ter-grouping berdasarkan modul/induk menu',
    description: 'Mengambil daftar seluruh resource key beserta level aksesnya untuk kebutuhan UI Role Matrix, ter-grouping secara rapi per modul.',
  })
  @ApiQuery({
    name: 'roleId',
    required: false,
    type: Number,
    description: 'ID Role opsional untuk melihat level akses yang terpasang pada role tersebut',
    example: 17,
  })
  @ApiResponse({
    status: 200,
    description: 'Berhasil mengambil daftar resource permissions yang ter-grouping.',
    schema: {
      example: {
        success: true,
        statusCode: 200,
        message: 'OK',
        data: [
          {
            group: 'Master Data',
            icon: 'settings',
            resources: [
              {
                id: 1,
                name: 'User Management',
                resource: 'User',
                icon: 'users',
                url: '/users',
                accessLevel: 'full-akses',
                availableAccessLevels: ['full-akses', 'admin-akses', 'change-akses', 'view-akses'],
              },
              {
                id: 2,
                name: 'Role Management',
                resource: 'Role',
                icon: 'shield',
                url: '/roles',
                accessLevel: 'view-akses',
                availableAccessLevels: ['full-akses', 'admin-akses', 'change-akses', 'view-akses'],
              },
            ],
          },
        ],
      },
    },
  })
  getGroupedResources(@Query('roleId') roleId?: string) {
    const parsedRoleId = roleId ? parseInt(roleId, 10) : undefined;
    return this.permissionService.getGroupedResourcePermissions(parsedRoleId);
  }

  @Get('role/:roleId/grouped')
  @RequirePermission('Permission', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar resource permissions yang ter-grouping khusus untuk Role ID tertentu',
  })
  @ApiResponse({
    status: 200,
    description: 'Berhasil mengambil daftar resource permissions spesifik Role ID.',
  })
  getGroupedResourcesByRoleId(@Param('roleId', ParseIntPipe) roleId: number) {
    return this.permissionService.getGroupedResourcePermissions(roleId);
  }

  @Put(':id')
  @RequirePermission('Permission', 'update')
  @ApiOperation({
    summary: 'Update hak akses (Permission) berdasarkan ID Permission',
    description: 'Memperbarui level akses atau nama resource dari record permission berdasarkan ID utamanya.',
  })
  @ApiBody({ type: UpdatePermissionByIdDto })
  @ApiResponse({
    status: 200,
    description: 'Hak akses permission berhasil diperbarui.',
  })
  updatePermissionById(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePermissionByIdDto,
  ) {
    return this.permissionService.updatePermissionById(id, dto);
  }

  @Put('sync')
  @RequirePermission('Permission', 'update')
  @ApiOperation({
    summary: 'Bulk Sync / Upsert banyak hak akses (Permissions) sekaligus untuk sebuah Role',
    description: 'Memperbarui atau menambahkan daftar permissions secara massal (bulk) untuk suatu role.',
  })
  @ApiBody({ type: SyncRolePermissionsDto })
  @ApiResponse({
    status: 200,
    description: 'Daftar hak akses permissions berhasil di-sync secara massal.',
  })
  syncPermissions(@Body() dto: SyncRolePermissionsDto) {
    return this.permissionService.syncRolePermissions(dto);
  }

  @Post('copy')
  @RequirePermission('Permission', 'update')
  @ApiOperation({
    summary: 'Menyalin (Copy) seluruh hak akses (Permissions) dari satu Role ke Role lain',
    description: 'Menyalin seluruh hak akses milik Role Sumber (misal: Super Admin) ke Role Tujuan. Mendukung mode "overwrite" (menimpa/menghapus permission lama) atau "merge" (menggabungkan permission).',
  })
  @ApiBody({ type: CopyRolePermissionsDto })
  @ApiResponse({
    status: 200,
    description: 'Hak akses permissions berhasil disalin antar role.',
  })
  copyPermissions(@Body() dto: CopyRolePermissionsDto) {
    return this.permissionService.copyRolePermissions(dto);
  }

  @Delete(':id')
  @RequirePermission('Permission', 'delete')
  @ApiOperation({
    summary: 'Menghapus hak akses (Permission) berdasarkan ID Permission',
    description: 'Menghapus record hak akses permission secara permanen berdasarkan ID utamanya.',
  })
  @ApiResponse({
    status: 200,
    description: 'Hak akses permission berhasil dihapus.',
  })
  deletePermissionById(@Param('id', ParseIntPipe) id: number) {
    return this.permissionService.deletePermissionById(id);
  }
}
