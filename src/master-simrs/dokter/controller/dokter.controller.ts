import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { RequirePermission } from '@src/permissions/decorators/require-permission.decorator';
import { PermissionGuard } from '@src/permissions/guards/permission.guard';
import { DokterService } from '../services/dokter.service';
import { CreateDokterDto } from '../dto/create-dokter.dto';
import { UpdateDokterDto } from '../dto/update-dokter.dto';
import { QueryDokterDto } from '../dto/query-dokter.dto';

@ApiTags('Master - Dokter')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('master/dokter')
export class DokterController {
  constructor(private readonly dokterService: DokterService) {}

  @Get()
  @RequirePermission('Dokter', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar master data dokter terpaginasi',
  })
  @ApiResponse({ status: 200, description: 'Daftar dokter berhasil diambil.' })
  findAll(@Query() queryDto: QueryDokterDto) {
    return this.dokterService.findAll(queryDto);
  }

  @Get('available-pegawai')
  @RequirePermission('Dokter', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar pegawai yang belum terdaftar sebagai dokter',
    description:
      'Digunakan pada dropdown pemilihan pegawai saat input master dokter.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Cari berdasarkan NIP atau nama pegawai',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar pegawai tersedia berhasil diambil.',
  })
  findAvailablePegawai(@Query('search') search = '') {
    return this.dokterService.findAvailablePegawai(search);
  }

  @Get('available-penduduk')
  @RequirePermission('Dokter', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar penduduk yang belum terdaftar sebagai dokter',
    description:
      'Digunakan pada dropdown pemilihan penduduk saat input master dokter.',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Cari berdasarkan NIK atau nama penduduk',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar penduduk tersedia berhasil diambil.',
  })
  findAvailablePenduduk(@Query('search') search = '') {
    return this.dokterService.findAvailablePenduduk(search);
  }

  @Get(':id')
  @RequirePermission('Dokter', 'view')
  @ApiOperation({
    summary:
      'Mendapatkan detail lengkap dokter beserta data penduduk & pegawai',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Detail dokter ditemukan.' })
  @ApiResponse({ status: 404, description: 'Data dokter tidak ditemukan.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.dokterService.findOne(id);
  }

  @Post()
  @RequirePermission('Dokter', 'create')
  @ApiOperation({
    summary:
      'Menambahkan master dokter baru (tautan existing atau input terpadu transaksional)',
    description:
      'Mendukung penautan pendudukId/pegawaiId yang sudah ada maupun pembuatan terpadu penduduk + pegawai + dokter dalam 1 transaksi DB.',
  })
  @ApiBody({ type: CreateDokterDto })
  @ApiResponse({
    status: 201,
    description: 'Data dokter berhasil ditambahkan.',
  })
  @ApiResponse({
    status: 400,
    description: 'Payload tidak valid atau silang referensi penduduk-pegawai.',
  })
  @ApiResponse({
    status: 409,
    description: 'Kode dokter, NIK, NIP, atau STR sudah terdaftar.',
  })
  create(@Body() dto: CreateDokterDto) {
    return this.dokterService.create(dto);
  }

  @Put(':id')
  @RequirePermission('Dokter', 'update')
  @ApiOperation({ summary: 'Memperbarui data master dokter' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: UpdateDokterDto })
  @ApiResponse({ status: 200, description: 'Data dokter berhasil diperbarui.' })
  @ApiResponse({ status: 404, description: 'Data dokter tidak ditemukan.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateDokterDto) {
    return this.dokterService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('Dokter', 'delete')
  @ApiOperation({ summary: 'Menghapus data master dokter (Soft Delete)' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Data dokter berhasil dihapus.' })
  @ApiResponse({
    status: 409,
    description: 'Data dokter masih digunakan di pelayanan.',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.dokterService.remove(id);
  }
}
