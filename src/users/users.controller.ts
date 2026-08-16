import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  ParseIntPipe,
  UseGuards,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
  UnprocessableEntityException,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UpdateUserDto, ToggleUserStatusDto, ResetPasswordDto } from './dto/update-user.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { UploadStorageHelper } from '@common/utils/upload-storage.util';
import { MulterFile } from '@common/types/multer-file.type';
import type { Response } from 'express';

@ApiTags('User Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Mendapatkan data profil user yang sedang login beserta detail pegawai' })
  getProfile(@Req() req: any) {
    const userId = req?.user?.userId || req?.user?.id;
    return this.usersService.getProfile(userId);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Memperbarui data pribadi profil pegawai' })
  @ApiBody({ type: UpdateProfileDto })
  updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    const userId = req?.user?.userId || req?.user?.id;
    return this.usersService.updateProfile(userId, dto);
  }

  @Put('profile/change-password')
  @ApiOperation({ summary: 'Mengubah kata sandi akun pengguna' })
  @ApiBody({ type: ChangePasswordDto })
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    const userId = req?.user?.userId || req?.user?.id;
    return this.usersService.changePassword(userId, dto);
  }

  @Post('profile/avatar')
  @ApiOperation({ summary: 'Mengunggah foto profil (avatar)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const tempPath = path.join(process.cwd(), 'storage/uploads/avatars/.tmp');
          if (!fs.existsSync(tempPath)) {
            fs.mkdirSync(tempPath, { recursive: true });
          }
          cb(null, tempPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${randomUUID()}`;
          const ext = path.extname(file.originalname).toLowerCase();
          cb(null, `avatar-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 2 * 1024 * 1024, // 2MB
      },
      fileFilter: (req, file, cb) => {
        const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (!allowedMimeTypes.includes(file.mimetype) || !allowedExtensions.includes(ext)) {
          return cb(
            new UnprocessableEntityException('Format gambar tidak diizinkan! Hanya JPG, PNG, dan WEBP.') as any,
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File avatar pengguna (JPG/PNG/WEBP, maks 2MB)',
        },
      },
    },
  })
  async uploadAvatar(@UploadedFile() file: MulterFile, @Req() req: any) {
    if (!file) {
      throw new UnprocessableEntityException('Silakan pilih berkas gambar.');
    }
    const userId = req?.user?.userId || req?.user?.id;
    const slug = req?.user?.slug || 'default';

    const { relativeFolder, absoluteFolder } = UploadStorageHelper.getUploadPath(slug, 'avatars');
    UploadStorageHelper.ensureDirectoryExists(absoluteFolder);

    const targetFilePath = path.join(absoluteFolder, file.filename);
    const sourcePath = file.path
      ? (path.isAbsolute(file.path) ? file.path : path.resolve(process.cwd(), file.path))
      : path.join(process.cwd(), 'storage/uploads/avatars/.tmp', file.filename);

    if (!fs.existsSync(sourcePath)) {
      throw new UnprocessableEntityException('Berkas sementara tidak ditemukan.');
    }

    UploadStorageHelper.moveFile(sourcePath, targetFilePath);

    const storedFileName = path.join(relativeFolder, file.filename).replace(/\\/g, '/');
    const relativeStoredPath = `/users/profile/avatar-stream/${storedFileName}`;

    return this.usersService.updateAvatar(userId, relativeStoredPath);
  }

  @Get('profile/avatar-stream/*path')
  @ApiOperation({ summary: 'Mendapatkan file foto profil (stream/serve)' })
  @ApiParam({ name: 'path', description: 'Relative path ke file avatar', type: 'string' })
  async streamAvatar(@Req() req: any, @Res() res: Response) {
    const rawPath = (req.params as any).path || req.params[0] || req.params['0'] || '';
    const filePath = UploadStorageHelper.resolveFileForStreaming(rawPath);

    if (!filePath) {
      throw new NotFoundException('Foto profil tidak ditemukan.');
    }

    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream';
    if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.webp') contentType = 'image/webp';

    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });

    fs.createReadStream(filePath).pipe(res);
  }

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
