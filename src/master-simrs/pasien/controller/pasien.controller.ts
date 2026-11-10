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
import { PasienService } from '../services/pasien.service';
import { CreatePasienDto } from '../dto/create-pasien.dto';
import { UpdatePasienDto } from '../dto/update-pasien.dto';
import { QueryPasienDto } from '../dto/query-pasien.dto';
import {
  CreatePasienPenjaminItemDto,
  UpdatePasienPenjaminItemDto,
} from '../dto/pasien-penjamin.dto';

@ApiTags('Master - Pasien')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('master/pasien')
export class PasienController {
  constructor(private readonly pasienService: PasienService) {}

  @Get()
  @RequirePermission('Pasien', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar master data pasien terpaginasi',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar pasien berhasil diambil.',
  })
  findAll(@Query() queryDto: QueryPasienDto) {
    return this.pasienService.findAll(queryDto);
  }

  @Get('lookup')
  @RequirePermission('Pasien', 'view')
  @ApiOperation({
    summary:
      'Pencarian cepat pasien (No. RM, NIK, Nama, atau No. Kartu Penjamin)',
    description:
      'Endpoint ringan (maksimal 20 hasil) untuk autocomplete saat pendaftaran kunjungan/IGD.',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Kata kunci pencarian No. RM / NIK / Nama / No. Kartu',
  })
  @ApiResponse({
    status: 200,
    description: 'Hasil pencarian cepat pasien berhasil diambil.',
  })
  lookup(@Query('q') q = '') {
    return this.pasienService.lookup(q);
  }

  @Get('no-rm/:noRm')
  @RequirePermission('Pasien', 'view')
  @ApiOperation({ summary: 'Mendapatkan detail pasien berdasarkan Nomor RM' })
  @ApiParam({
    name: 'noRm',
    example: '00000001',
    description: 'Nomor Rekam Medis',
  })
  @ApiResponse({ status: 200, description: 'Detail pasien ditemukan.' })
  @ApiResponse({ status: 404, description: 'Pasien tidak ditemukan.' })
  findByNoRm(@Param('noRm') noRm: string) {
    return this.pasienService.findByNoRm(noRm);
  }

  @Get(':id')
  @RequirePermission('Pasien', 'view')
  @ApiOperation({
    summary:
      'Mendapatkan detail lengkap pasien beserta kependudukan, domisili, dan daftar penjamin',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Detail pasien ditemukan.' })
  @ApiResponse({ status: 404, description: 'Data pasien tidak ditemukan.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pasienService.findOne(id);
  }

  @Post()
  @RequirePermission('Pasien', 'create')
  @ApiOperation({
    summary:
      'Mendaftarkan master pasien baru (tautan penduduk eksisting atau input terpadu + multi penjamin)',
    description:
      'Mendukung auto-generate No. RM atomik (00000001 atau 00-00-01) maupun input manual migrasi, kasus bayi/IGD tanpa NIK, dan banyak penjamin dalam 1 transaksi DB.',
  })
  @ApiBody({ type: CreatePasienDto })
  @ApiResponse({
    status: 201,
    description: 'Data pasien berhasil ditambahkan.',
  })
  @ApiResponse({ status: 400, description: 'Payload tidak valid.' })
  @ApiResponse({
    status: 409,
    description: 'No. RM, NIK, atau data penduduk sudah terdaftar.',
  })
  create(@Body() dto: CreatePasienDto) {
    return this.pasienService.create(dto);
  }

  @Put(':id')
  @RequirePermission('Pasien', 'update')
  @ApiOperation({ summary: 'Memperbarui data master pasien' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: UpdatePasienDto })
  @ApiResponse({ status: 200, description: 'Data pasien berhasil diperbarui.' })
  @ApiResponse({ status: 404, description: 'Data pasien tidak ditemukan.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePasienDto) {
    return this.pasienService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('Pasien', 'delete')
  @ApiOperation({ summary: 'Menghapus data master pasien' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Data pasien berhasil dihapus.' })
  @ApiResponse({
    status: 409,
    description: 'Data pasien masih terhubung dengan rekam medis/kunjungan.',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.pasienService.remove(id);
  }

  @Get(':id/penjamin')
  @RequirePermission('Pasien', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar penjamin/asuransi milik pasien',
  })
  @ApiParam({ name: 'id', type: Number, example: 1, description: 'ID Pasien' })
  @ApiResponse({
    status: 200,
    description: 'Daftar penjamin pasien berhasil diambil.',
  })
  listPenjamin(@Param('id', ParseIntPipe) id: number) {
    return this.pasienService.listPenjamin(id);
  }

  @Post(':id/penjamin')
  @RequirePermission('Pasien', 'update')
  @ApiOperation({ summary: 'Menambahkan penjamin/asuransi baru untuk pasien' })
  @ApiParam({ name: 'id', type: Number, example: 1, description: 'ID Pasien' })
  @ApiBody({ type: CreatePasienPenjaminItemDto })
  @ApiResponse({
    status: 201,
    description: 'Penjamin pasien berhasil ditambahkan.',
  })
  addPenjamin(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreatePasienPenjaminItemDto,
  ) {
    return this.pasienService.addPenjamin(id, dto);
  }

  @Put(':id/penjamin/:penjaminId')
  @RequirePermission('Pasien', 'update')
  @ApiOperation({ summary: 'Memperbarui data penjamin/asuransi pasien' })
  @ApiParam({ name: 'id', type: Number, example: 1, description: 'ID Pasien' })
  @ApiParam({
    name: 'penjaminId',
    type: Number,
    example: 1,
    description: 'ID Penjamin Pasien',
  })
  @ApiBody({ type: UpdatePasienPenjaminItemDto })
  @ApiResponse({
    status: 200,
    description: 'Penjamin pasien berhasil diperbarui.',
  })
  updatePenjamin(
    @Param('id', ParseIntPipe) id: number,
    @Param('penjaminId', ParseIntPipe) penjaminId: number,
    @Body() dto: UpdatePasienPenjaminItemDto,
  ) {
    return this.pasienService.updatePenjamin(id, penjaminId, dto);
  }

  @Delete(':id/penjamin/:penjaminId')
  @RequirePermission('Pasien', 'update')
  @ApiOperation({
    summary: 'Menghapus data penjamin/asuransi pasien (Soft Delete)',
  })
  @ApiParam({ name: 'id', type: Number, example: 1, description: 'ID Pasien' })
  @ApiParam({
    name: 'penjaminId',
    type: Number,
    example: 1,
    description: 'ID Penjamin Pasien',
  })
  @ApiResponse({
    status: 200,
    description: 'Penjamin pasien berhasil dihapus.',
  })
  removePenjamin(
    @Param('id', ParseIntPipe) id: number,
    @Param('penjaminId', ParseIntPipe) penjaminId: number,
  ) {
    return this.pasienService.removePenjamin(id, penjaminId);
  }
}
