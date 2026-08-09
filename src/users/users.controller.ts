import {
  Controller,
  Get,
  Put,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto, ToggleUserStatusDto, ResetPasswordDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';

@ApiTags('User Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('all')
  @RequirePermission('User', 'view')
  @ApiOperation({
    summary: 'Mendapatkan SELURUH daftar Pengguna tanpa pagination (untuk Select2 / Dropdown / List Lengkap)',
    description: 'Mengambil seluruh daftar pengguna aktif/semua pada tenant aktif.',
  })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'john' })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean, example: true })
  getAll(
    @Query('search') search?: string,
    @Query('is_active') isActive?: boolean,
  ) {
    return this.usersService.getAllUsers(
      search || '',
      isActive !== undefined ? String(isActive) === 'true' : undefined,
    );
  }

  @Get()
  @RequirePermission('User', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar seluruh Pengguna (dengan Pagination, Search Username/Role, dan Filter)',
    description: 'Mengambil daftar pengguna yang ter-scope pada tenant aktif. Jika all=true, mengembalikan seluruh list tanpa pagination.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'search', required: false, type: String, example: 'john' })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean, example: true })
  @ApiQuery({ name: 'role_id', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'all', required: false, type: Boolean, example: false })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('is_active') isActive?: boolean,
    @Query('role_id') roleId?: number,
    @Query('all') all?: boolean,
  ) {
    const isActiveParsed = isActive !== undefined ? String(isActive) === 'true' : undefined;
    const roleIdParsed = roleId ? +roleId : undefined;

    if (String(all) === 'true' || limit === -1) {
      return this.usersService.getAllUsers(search || '', isActiveParsed);
    }

    return this.usersService.findAllUsers(
      page ? +page : 1,
      limit ? +limit : 10,
      search || '',
      isActiveParsed,
      roleIdParsed,
    );
  }

  @Get(':id')
  @RequirePermission('User', 'view')
  @ApiOperation({ summary: 'Mendapatkan detail Pengguna berdasarkan ID' })
  @ApiResponse({ status: 200, description: 'Detail pengguna ditemukan.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findById(id);
  }

  @Put(':id')
  @RequirePermission('User', 'update')
  @ApiOperation({
    summary: 'Memperbarui data Pengguna (Username, Role, Password, Status)',
    description: 'Memperbarui informasi pengguna berdasarkan ID Pengguna.',
  })
  @ApiBody({ type: UpdateUserDto })
  @ApiResponse({ status: 200, description: 'Data pengguna berhasil diperbarui.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('User', 'update')
  @ApiOperation({
    summary: 'Mengubah status keaktifan Pengguna (Aktif / Non-Aktif)',
    description: 'Mengaktifkan atau menonaktifkan akun pengguna.',
  })
  @ApiBody({ type: ToggleUserStatusDto })
  @ApiResponse({ status: 200, description: 'Status pengguna berhasil diperbarui.' })
  toggleStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ToggleUserStatusDto,
  ) {
    return this.usersService.toggleUserStatus(id, dto.is_active);
  }

  @Delete(':id')
  @RequirePermission('User', 'delete')
  @ApiOperation({
    summary: 'Menonaktifkan / Menghapus Pengguna (Soft Delete)',
    description: 'Menghapus data pengguna secara soft delete.',
  })
  @ApiResponse({ status: 200, description: 'Pengguna berhasil dihapus / dinonaktifkan.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.removeUser(id);
  }

  @Patch(':id/reset-password')
  @RequirePermission('User', 'update')
  @ApiOperation({
    summary: 'Reset Password Pengguna ke Default (password123)',
    description: 'Mereset password akun pengguna menjadi password default (password123).',
  })
  @ApiBody({ type: ResetPasswordDto, required: false })
  @ApiResponse({ status: 200, description: 'Password pengguna berhasil di-reset.' })
  resetPassword(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto?: ResetPasswordDto,
  ) {
    return this.usersService.resetUserPassword(id, dto?.new_password);
  }
}
