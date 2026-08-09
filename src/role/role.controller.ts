import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { RoleService } from './role.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AddPermissionsDto } from './dto/add-permission-role.dto';
import { ResponseMessage } from '@common/decorators/message.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

@ApiTags('Role Management')
@ApiBearerAuth() // Tambahkan ikon kunci (butuh JWT) di Swagger UI
@Controller('role')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @Post()
  @ApiOperation({ summary: 'Membuat Role baru' })
  @ApiResponse({ status: 201, description: 'Role berhasil dibuat.' })
  create(@Body() createRoleDto: CreateRoleDto) {
    return this.roleService.create(createRoleDto);
  }

  @Post('permissions')
  @ApiOperation({ summary: 'Menambahkan atau update hak akses (permissions) ke sebuah Role' })
  @ResponseMessage('Permissions berhasil diperbarui')
  async addPermissions(@Body() dto: AddPermissionsDto) {
    return await this.roleService.addPermissions(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Mendapatkan daftar semua Role (dengan Pagination)' })
  findAll() {
    return this.roleService.findAll();
  }

  @Get('menu')
  @ApiOperation({ summary: 'Mendapatkan daftar Menu berdasarkan otorisasi Role aktif' })
  findAllMenu() {
    return this.roleService.findAllMenu();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Mendapatkan detail Role berdasarkan ID' })
  findOne(@Param('id') id: string) {
    return this.roleService.findOne(+id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Memperbarui data Role (Nama/Deskripsi)' })
  update(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.roleService.update(+id, updateRoleDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Menghapus Role beserta seluruh permissions-nya' })
  remove(@Param('id') id: string) {
    return this.roleService.remove(+id);
  }
}
