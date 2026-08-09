import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AddPermissionsDto } from './dto/add-permission-role.dto';
import { ResponseMessage } from '@common/decorators/message.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';

@ApiTags('Role Management')
@ApiBearerAuth() // Tambahkan ikon kunci (butuh JWT) di Swagger UI
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @RequirePermission('Role', 'create')
  @ApiOperation({ summary: 'Membuat Role baru' })
  @ApiResponse({ status: 201, description: 'Role berhasil dibuat.' })
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.roleService.create(createRoleDto);
  }

  @Post('permissions')
  @RequirePermission('Role', 'update')
  @ApiOperation({ summary: 'Menambahkan atau update hak akses (permissions) ke sebuah Role' })
  @ResponseMessage('Permissions berhasil diperbarui')
  async addPermissions(@Body() dto: AddPermissionsDto) {
    return await this.roleService.addPermissions(dto);
  }

  @Get()
  @RequirePermission('Role', 'view')
  @ApiOperation({ summary: 'Mendapatkan daftar semua Role (dengan Pagination)' })
  findAll() {
    return this.roleService.findAll();
  }

  @Get('menu')
  @RequirePermission('Role', 'view')
  @ApiOperation({ summary: 'Mendapatkan daftar Menu berdasarkan otorisasi Role aktif' })
  findAllMenu() {
    return this.roleService.findAllMenu();
  }

  @Get(':id')
  @RequirePermission('Role', 'view')
  @ApiOperation({ summary: 'Mendapatkan detail Role berdasarkan ID' })
  findOne(@Param('id') id: string) {
    return this.roleService.findOne(+id);
  }

  @Patch(':id')
  @RequirePermission('Role', 'update')
  @ApiOperation({ summary: 'Memperbarui data Role (Nama/Deskripsi)' })
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.roleService.update(+id, updateRoleDto);
  }

  @Delete(':id')
  @RequirePermission('Role', 'delete')
  @ApiOperation({ summary: 'Menghapus Role beserta seluruh permissions-nya' })
  remove(@Param('id') id: string) {
    return this.roleService.remove(+id);
  }
}
