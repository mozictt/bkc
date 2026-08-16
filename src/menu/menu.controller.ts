import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { MenuService } from './menu.service';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';

@ApiTags('Menus')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('menus')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Post()
  @RequirePermission('Menu', 'create')
  @ApiOperation({
    summary: 'Buat menu baru',
    description: 'Membuat menu baru. Field URL bersifat opsional (terutama untuk menu parent).',
  })
  @ApiResponse({ status: 201, description: 'Menu berhasil dibuat.' })
  @ApiResponse({ status: 400, description: 'Validasi gagal.' })
  create(@Body() dto: CreateMenuDto) {
    return this.menuService.createMenu(dto);
  }

  @Get()
  @RequirePermission('Menu', 'view')
  @ApiOperation({
    summary: 'Ambil semua menu root',
    description: 'Mengambil semua data menu tingkat teratas (parent is null) beserta anak-anaknya.',
  })
  @ApiResponse({ status: 200, description: 'Daftar menu berhasil diambil.' })
  findAll() {
    return this.menuService.getAllMenus();
  }

  @Get('role/:id')
  @ApiOperation({
    summary: 'Ambil hierarki menu berdasarkan Role ID',
    description: 'Mengambil pohon hierarki menu yang disesuaikan dengan tingkat akses Role ID tertentu.',
  })
  @ApiParam({ name: 'id', description: 'ID Role', type: 'number' })
  @ApiResponse({ status: 200, description: 'Hierarki menu role berhasil diambil.' })
  findAllByRoleId(@Param('id', ParseIntPipe) id: number) {
    return this.menuService.getAllMenusByRoleId(id);
  }

  @Put('permissions')
  @RequirePermission('Menu', 'update')
  @ApiOperation({
    summary: 'Update hak akses role pada menu',
    description: 'Memperbarui level akses role untuk resource menu tertentu.',
  })
  @ApiResponse({ status: 200, description: 'Hak akses berhasil diperbarui.' })
  updatePermission(@Body() dto: UpdatePermissionDto) {
    return this.menuService.updateRoleMenuPermission(dto);
  }

  @Get(':id')
  @RequirePermission('Menu', 'view')
  @ApiOperation({
    summary: 'Ambil detail menu berdasarkan ID',
    description: 'Mengambil data spesifik satu menu berdasarkan ID.',
  })
  @ApiParam({ name: 'id', description: 'ID Menu', type: 'number' })
  @ApiResponse({ status: 200, description: 'Detail menu berhasil diambil.' })
  @ApiResponse({ status: 404, description: 'Menu tidak ditemukan.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.menuService.getMenuById(id);
  }

  @Put(':id')
  @RequirePermission('Menu', 'update')
  @ApiOperation({
    summary: 'Update data menu',
    description: 'Memperbarui informasi menu berdasarkan ID.',
  })
  @ApiParam({ name: 'id', description: 'ID Menu', type: 'number' })
  @ApiResponse({ status: 200, description: 'Menu berhasil diperbarui.' })
  @ApiResponse({ status: 404, description: 'Menu tidak ditemukan.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateMenuDto) {
    return this.menuService.updateMenu(id, dto);
  }

  @Delete(':id')
  @RequirePermission('Menu', 'delete')
  @ApiOperation({
    summary: 'Hapus menu',
    description: 'Menghapus menu dari database berdasarkan ID.',
  })
  @ApiParam({ name: 'id', description: 'ID Menu', type: 'number' })
  @ApiResponse({ status: 200, description: 'Menu berhasil dihapus.' })
  @ApiResponse({ status: 404, description: 'Menu tidak ditemukan.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.menuService.deleteMenu(id);
  }
}

