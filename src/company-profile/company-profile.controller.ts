// src/company-profile/company-profile.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Res,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import type { Response } from 'express';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';

import { CompanyProfileService } from './company-profile.service';
import { CreateCompanyProfileDto } from './dto/create-company-profile.dto';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';

// ─── Konfigurasi Multer untuk Upload Logo ─────────────────────────────────

const logoStorage = diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = './storage/uploads/.tmp';
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${randomUUID()}`;
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `logo-${uniqueSuffix}${ext}`);
  },
});

const logoFileFilter = (
  req: any,
  file: Express.Multer.File,
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  const validExt = /\.(jpg|jpeg|png|webp|svg)$/i.test(file.originalname);
  const validMime = /^(image\/(jpeg|jpg|pjpeg|png|x-png|webp|svg\+xml|svg)|application\/octet-stream)$/i.test(file.mimetype);

  if (!validExt || !validMime) {
    return cb(
      new BadRequestException('Hanya file gambar (JPG, PNG, WEBP, SVG) yang diizinkan') as any,
      false,
    );
  }
  cb(null, true);
};

// ─── Controller ─────────────────────────────────────────────────────────────

@ApiTags('Company Profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('company-profile')
export class CompanyProfileController {
  constructor(private readonly companyProfileService: CompanyProfileService) {}

  // ── GET /company-profile ────────────────────────────────────────────────

  @Get()
  @RequirePermission('CompanyProfile', 'view')
  @ApiOperation({
    summary: 'Ambil profil perusahaan',
    description: 'Mengambil profil perusahaan milik tenant yang sedang aktif.',
  })
  @ApiResponse({ status: 200, description: 'Profil perusahaan berhasil diambil.' })
  @ApiResponse({ status: 404, description: 'Profil perusahaan belum dikonfigurasi.' })
  getProfile(@Req() req: any) {
    const userId = req?.user?.userId || req?.user?.id;
    return this.companyProfileService.getProfile(userId);
  }


  // ── GET /company-profile/logo/*path ────────────────────────────────
  @Get('logo/*path')
  @RequirePermission('CompanyProfile', 'view')
  @ApiOperation({
    summary: 'Stream / Ambil file logo perusahaan',
    description: 'Mengambil file gambar logo perusahaan berdasarkan path relatif atau nama file.',
  })
  @ApiParam({ name: 'path', description: 'Relative path atau nama file logo', type: 'string' })
  @ApiResponse({ status: 200, description: 'File logo berhasil diambil.' })
  @ApiResponse({ status: 404, description: 'File logo tidak ditemukan.' })
  getLogo(
    @Req() req: any,
    @Res() res: Response,
  ) {
    const rawPath = (req.params as any).path || req.params[0] || req.params['0'] || '';
    return this.companyProfileService.streamLogo(rawPath, res);
  }

  // ── POST /company-profile ───────────────────────────────────────────────

  @Post()
  @RequirePermission('CompanyProfile', 'create')
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: logoStorage,
      fileFilter: logoFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 }, // Maks 5MB
    }),
  )
  @ApiOperation({
    summary: 'Buat profil perusahaan baru',
    description:
      'Membuat profil perusahaan baru untuk tenant aktif. Hanya boleh ada satu profil per tenant.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Data profil perusahaan beserta logo (opsional)',
    schema: {
      type: 'object',
      required: ['name', 'email', 'phone', 'address'],
      properties: {
        name: { type: 'string', example: 'PT. Maju Bersama Teknologi' },
        shortName: { type: 'string', example: 'MBT' },
        description: { type: 'string' },
        email: { type: 'string', format: 'email', example: 'info@mbt.co.id' },
        phone: { type: 'string', example: '021-12345678' },
        fax: { type: 'string', example: '021-87654321' },
        website: { type: 'string', example: 'https://mbt.co.id' },
        address: { type: 'string', example: 'Jl. Sudirman No. 99' },
        city: { type: 'string', example: 'Jakarta Pusat' },
        province: { type: 'string', example: 'DKI Jakarta' },
        postalCode: { type: 'string', example: '10220' },
        country: { type: 'string', example: 'Indonesia' },
        idKelurahan: { type: 'string', example: '31.71.01.1001', description: 'ID Kelurahan domisili (Kemendagri)' },
        npwp: { type: 'string', example: '01.234.567.8-901.000' },
        nib: { type: 'string', example: '1234567890123' },
        foundedAt: { type: 'string', format: 'date', example: '2010-01-15' },
        instagram: { type: 'string', example: 'https://instagram.com/mbt' },
        facebook: { type: 'string', example: 'https://facebook.com/mbt' },
        twitter: { type: 'string', example: 'https://twitter.com/mbt' },
        linkedin: { type: 'string', example: 'https://linkedin.com/company/mbt' },
        logo: {
          type: 'string',
          format: 'binary',
          description: 'File logo perusahaan (JPG/PNG/WEBP/SVG, maks 5MB)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Profil perusahaan berhasil dibuat.' })
  @ApiResponse({ status: 400, description: 'Validasi gagal.' })
  @ApiResponse({ status: 409, description: 'Profil perusahaan sudah ada.' })
  createProfile(
    @Body() dto: CreateCompanyProfileDto,
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    return this.companyProfileService.createProfile(dto, logo);
  }

  // ── PUT /company-profile/:id ────────────────────────────────────────────

  @Put(':id')
  @RequirePermission('CompanyProfile', 'update')
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: logoStorage,
      fileFilter: logoFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'Update profil perusahaan',
    description: 'Memperbarui data profil perusahaan berdasarkan ID.',
  })
  @ApiParam({ name: 'id', description: 'ID profil perusahaan', type: 'number' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Data yang ingin diperbarui (semua field opsional)',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        shortName: { type: 'string' },
        description: { type: 'string' },
        email: { type: 'string', format: 'email' },
        phone: { type: 'string' },
        fax: { type: 'string' },
        website: { type: 'string' },
        address: { type: 'string' },
        city: { type: 'string' },
        province: { type: 'string' },
        postalCode: { type: 'string' },
        country: { type: 'string' },
        idKelurahan: { type: 'string', example: '31.71.01.1001', description: 'ID Kelurahan domisili (Kemendagri)' },
        npwp: { type: 'string' },
        nib: { type: 'string' },
        foundedAt: { type: 'string', format: 'date' },
        instagram: { type: 'string' },
        facebook: { type: 'string' },
        twitter: { type: 'string' },
        linkedin: { type: 'string' },
        logo: { type: 'string', format: 'binary', description: 'Logo baru (opsional)' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Profil perusahaan berhasil diperbarui.' })
  @ApiResponse({ status: 404, description: 'Profil perusahaan tidak ditemukan.' })
  updateProfile(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompanyProfileDto,
    @UploadedFile() logo?: Express.Multer.File,
  ) {
    return this.companyProfileService.updateProfile(id, dto, logo);
  }

  // ── POST /company-profile/:id/logo ─────────────────────────────────────

  @Post(':id/logo')
  @RequirePermission('CompanyProfile', 'update')
  @UseInterceptors(
    FileInterceptor('logo', {
      storage: logoStorage,
      fileFilter: logoFileFilter,
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'Upload / Ganti logo perusahaan',
    description: 'Mengunggah atau mengganti logo perusahaan (logo lama akan dihapus otomatis).',
  })
  @ApiParam({ name: 'id', description: 'ID profil perusahaan', type: 'number' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['logo'],
      properties: {
        logo: {
          type: 'string',
          format: 'binary',
          description: 'File logo perusahaan (JPG/PNG/WEBP/SVG, maks 5MB)',
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Logo perusahaan berhasil diperbarui.' })
  @ApiResponse({ status: 400, description: 'File logo tidak ditemukan dalam request.' })
  @ApiResponse({ status: 404, description: 'Profil perusahaan tidak ditemukan.' })
  uploadLogo(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() logo: Express.Multer.File,
  ) {
    return this.companyProfileService.uploadLogo(id, logo);
  }

  // ── DELETE /company-profile/:id/logo ───────────────────────────────────

  @Delete(':id/logo')
  @RequirePermission('CompanyProfile', 'update')
  @ApiOperation({
    summary: 'Hapus logo perusahaan',
    description: 'Menghapus file logo perusahaan dari storage dan database.',
  })
  @ApiParam({ name: 'id', description: 'ID profil perusahaan', type: 'number' })
  @ApiResponse({ status: 200, description: 'Logo berhasil dihapus.' })
  @ApiResponse({ status: 404, description: 'Profil atau logo tidak ditemukan.' })
  removeLogo(@Param('id', ParseIntPipe) id: number) {
    return this.companyProfileService.removeLogo(id);
  }

  // ── DELETE /company-profile/:id ────────────────────────────────────────

  @Delete(':id')
  @RequirePermission('CompanyProfile', 'delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hapus profil perusahaan (soft delete)',
    description:
      'Menghapus profil perusahaan secara soft delete (data tidak dihapus permanen dari database).',
  })
  @ApiParam({ name: 'id', description: 'ID profil perusahaan', type: 'number' })
  @ApiResponse({ status: 200, description: 'Profil perusahaan berhasil dihapus.' })
  @ApiResponse({ status: 404, description: 'Profil perusahaan tidak ditemukan.' })
  removeProfile(@Param('id', ParseIntPipe) id: number) {
    return this.companyProfileService.removeProfile(id);
  }
}
