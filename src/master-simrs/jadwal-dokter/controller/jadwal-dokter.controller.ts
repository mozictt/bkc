import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { RequirePermission } from '@src/permissions/decorators/require-permission.decorator';
import { PermissionGuard } from '@src/permissions/guards/permission.guard';
import { JadwalDokterService } from '../services/jadwal-dokter.service';
import {
  BulkCreateJadwalDokterDto,
  CreateJadwalDokterDto,
  UpdateStatusJadwalDokterDto,
} from '../dto/create-jadwal-dokter.dto';
import { UpdateJadwalDokterDto } from '../dto/update-jadwal-dokter.dto';
import {
  QueryJadwalDokterDto,
  QueryMingguanJadwalDokterDto,
  QueryOptionsJadwalDokterDto,
} from '../dto/query-jadwal-dokter.dto';

@ApiTags('Master - Jadwal Dokter')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('master/jadwal-dokter')
export class JadwalDokterController {
  constructor(private readonly jadwalDokterService: JadwalDokterService) {}

  @Get()
  @RequirePermission('Jadwal Dokter', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar master jadwal praktik dokter terpaginasi',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar jadwal dokter berhasil diambil.',
  })
  findAll(@Query() queryDto: QueryJadwalDokterDto) {
    return this.jadwalDokterService.findAll(queryDto);
  }

  @Get('options')
  @RequirePermission('Jadwal Dokter', 'view')
  @ApiOperation({
    summary:
      'Mendapatkan daftar jadwal dokter aktif untuk dropdown pendaftaran rawat jalan / antrean',
    description:
      'Mendukung filter unitId, dokterId, hari, sesi, serta konversi otomatis tanggal (YYYY-MM-DD) menjadi hari praktik.',
  })
  @ApiResponse({
    status: 200,
    description: 'Opsi jadwal dokter aktif berhasil diambil.',
  })
  @ApiResponse({
    status: 400,
    description: 'Format tanggal tidak valid atau tidak sesuai filter hari.',
  })
  findOptions(@Query() queryDto: QueryOptionsJadwalDokterDto) {
    return this.jadwalDokterService.findOptions(queryDto);
  }

  @Get('mingguan')
  @RequirePermission('Jadwal Dokter', 'view')
  @ApiOperation({
    summary:
      'Mendapatkan rekapitulasi jadwal praktik aktif dokter per hari (Senin - Minggu)',
  })
  @ApiResponse({
    status: 200,
    description: 'Rekap jadwal mingguan dokter berhasil diambil.',
  })
  getWeeklySchedule(@Query() queryDto: QueryMingguanJadwalDokterDto) {
    return this.jadwalDokterService.getWeeklySchedule(queryDto);
  }

  @Get(':id')
  @RequirePermission('Jadwal Dokter', 'view')
  @ApiOperation({
    summary: 'Mendapatkan detail master jadwal dokter berdasarkan ID',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Detail jadwal dokter ditemukan.' })
  @ApiResponse({
    status: 404,
    description: 'Data jadwal dokter tidak ditemukan.',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.jadwalDokterService.findOne(id);
  }

  @Post()
  @RequirePermission('Jadwal Dokter', 'create')
  @ApiOperation({
    summary: 'Menambahkan jadwal praktik dokter baru',
    description:
      'Memvalidasi dokter dan unit aktif per tenant, konsistensi jam & kuota, serta mencegah jadwal bentrok pada hari yang sama.',
  })
  @ApiBody({ type: CreateJadwalDokterDto })
  @ApiResponse({
    status: 201,
    description: 'Jadwal dokter berhasil ditambahkan.',
  })
  @ApiResponse({
    status: 400,
    description: 'Payload tidak valid atau referensi dokter/unit tidak aktif.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Jadwal praktik bentrok dengan jadwal aktif dokter lainnya pada hari tersebut.',
  })
  create(@Body() dto: CreateJadwalDokterDto) {
    return this.jadwalDokterService.create(dto);
  }

  @Post('bulk')
  @RequirePermission('Jadwal Dokter', 'create')
  @ApiOperation({
    summary:
      'Menambahkan jadwal praktik dokter untuk banyak hari sekaligus dalam 1 transaksi atomik',
    description:
      'Jika terdapat satu hari saja yang bentrok dengan jadwal aktif dokter, seluruh penyimpanan dibatalkan (rollback).',
  })
  @ApiBody({ type: BulkCreateJadwalDokterDto })
  @ApiResponse({
    status: 201,
    description: 'Seluruh jadwal dokter berhasil ditambahkan.',
  })
  @ApiResponse({
    status: 400,
    description: 'Payload tidak valid atau referensi dokter/unit tidak aktif.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Salah satu atau lebih hari bentrok dengan jadwal aktif dokter.',
  })
  bulkCreate(@Body() dto: BulkCreateJadwalDokterDto) {
    return this.jadwalDokterService.bulkCreate(dto);
  }

  @Put(':id')
  @RequirePermission('Jadwal Dokter', 'update')
  @ApiOperation({ summary: 'Memperbarui data master jadwal dokter' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: UpdateJadwalDokterDto })
  @ApiResponse({
    status: 200,
    description: 'Data jadwal dokter berhasil diperbarui.',
  })
  @ApiResponse({
    status: 404,
    description: 'Data jadwal dokter tidak ditemukan.',
  })
  @ApiResponse({
    status: 409,
    description: 'Perubahan jadwal bentrok dengan jadwal aktif dokter lain.',
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateJadwalDokterDto,
  ) {
    return this.jadwalDokterService.update(id, dto);
  }

  @Patch(':id/status')
  @RequirePermission('Jadwal Dokter', 'update')
  @ApiOperation({
    summary: 'Mengubah status aktif jadwal dokter (Y = Aktif, N = Nonaktif)',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: UpdateStatusJadwalDokterDto })
  @ApiResponse({
    status: 200,
    description: 'Status jadwal dokter berhasil diperbarui.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Jadwal tidak dapat diaktifkan kembali karena bentrok dengan jadwal aktif lain.',
  })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatusJadwalDokterDto,
  ) {
    return this.jadwalDokterService.updateStatus(id, dto);
  }

  @Delete(':id')
  @RequirePermission('Jadwal Dokter', 'delete')
  @ApiOperation({ summary: 'Menghapus data master jadwal dokter' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Data jadwal dokter berhasil dihapus.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Jadwal dokter tidak dapat dihapus karena masih digunakan pada transaksi pendaftaran atau antrean.',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.jadwalDokterService.remove(id);
  }
}

