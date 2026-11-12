import {
  Body,
  Controller,
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
import { PendaftaranService } from '../services/pendaftaran.service';
import { CreatePendaftaranDto } from '../dto/create-pendaftaran.dto';
import { MutasiPendaftaranDto } from '../dto/mutasi-pendaftaran.dto';
import { UpdatePenjaminPendaftaranDto } from '../dto/update-penjamin-pendaftaran.dto';
import {
  BatalPendaftaranDto,
  BatalRanapDto,
  SelesaiPendaftaranDto,
} from '../dto/update-status-pendaftaran.dto';
import {
  QueryJadwalTersediaDto,
  QueryPendaftaranDto,
} from '../dto/query-pendaftaran.dto';

@ApiTags('Transaksi - Pendaftaran')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('transaksi/pendaftaran')
export class PendaftaranController {
  constructor(private readonly pendaftaranService: PendaftaranService) {}

  @Get()
  @RequirePermission('Pendaftaran', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar transaksi pendaftaran pasien terpaginasi',
    description:
      'Menampilkan kunjungan rawat jalan, IGD, dan rawat inap beserta informasi pasien, cara bayar/penjamin, unit, dokter, dan bed saat ini.',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar transaksi pendaftaran berhasil diambil.',
  })
  findAll(@Query() queryDto: QueryPendaftaranDto) {
    return this.pendaftaranService.findAll(queryDto);
  }

  @Get('jadwal-dokter')
  @RequirePermission('Pendaftaran', 'view')
  @ApiOperation({
    summary:
      'Mendapatkan daftar jadwal praktik dokter tersedia beserta sisa kuota JKN & Non-JKN',
    description:
      'Memetakan tanggal kunjungan (YYYY-MM-DD) ke hari praktik dokter, memfilter jadwal/dokter/unit aktif, serta menghitung sisa kuota aktual tanpa N+1 query.',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar jadwal praktik dokter tersedia berhasil diambil.',
  })
  @ApiResponse({
    status: 400,
    description: 'Format tanggal kunjungan tidak valid.',
  })
  findJadwalDokterTersedia(@Query() queryDto: QueryJadwalTersediaDto) {
    return this.pendaftaranService.findJadwalDokterTersedia(queryDto);
  }

  @Get(':id')
  @RequirePermission('Pendaftaran', 'view')
  @ApiOperation({
    summary:
      'Mendapatkan detail lengkap kunjungan pendaftaran beserta riwayat perpindahan antar unit',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Detail transaksi pendaftaran ditemukan.',
  })
  @ApiResponse({
    status: 404,
    description: 'Data pendaftaran tidak ditemukan.',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pendaftaranService.findOne(id);
  }

  @Get(':id/history-unit')
  @RequirePermission('Pendaftaran', 'view')
  @ApiOperation({
    summary:
      'Mendapatkan riwayat kronologis perpindahan pasien antar unit / bed / dokter',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({
    status: 200,
    description: 'Riwayat perpindahan unit berhasil diambil.',
  })
  @ApiResponse({
    status: 404,
    description: 'Data pendaftaran tidak ditemukan.',
  })
  findHistoryUnit(@Param('id', ParseIntPipe) id: number) {
    return this.pendaftaranService.findHistoryUnit(id);
  }

  @Post()
  @RequirePermission('Pendaftaran', 'create')
  @ApiOperation({
    summary:
      'Mendaftarkan kunjungan pasien baru maupun pasien lama (Umum atau Asuransi) dalam 1 transaksi atomik',
    description:
      'Mendukung pembuatan pasien baru terpadu (penduduk + No. RM + penjamin), pemilihan cara bayar Umum atau Asuransi/BPJS, pemilihan dokter berbasis jadwal praktik + kuota + nomor antrean otomatis untuk Rajal, serta alokasi bed KOSONG untuk Ranap/IGD.',
  })
  @ApiBody({ type: CreatePendaftaranDto })
  @ApiResponse({
    status: 201,
    description: 'Pendaftaran pasien berhasil dibuat.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Payload tidak valid atau aturan jadwal/penjamin tidak terpenuhi.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Kuota jadwal penuh, bed tidak tersedia, atau pasien masih memiliki rawat inap aktif.',
  })
  create(@Body() dto: CreatePendaftaranDto) {
    return this.pendaftaranService.create(dto);
  }

  @Post(':id/mutasi')
  @RequirePermission('Pendaftaran', 'update')
  @ApiOperation({
    summary:
      'Memproses mutasi pasien antar unit (Rajal->Rajal, Rajal/IGD->Ranap, Ranap->Ranap/Pindah Bed)',
    description:
      'Mutasi ke Poliklinik Rawat Jalan tetap memotong kuota jadwal poli tujuan dan menghasilkan nomor antrean baru. Pasien yang sedang Rawat Inap tidak dapat dimutasi kembali ke Rawat Jalan (harus melalui Batal Ranap). Bed lama otomatis kembali berstatus KOSONG.',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: MutasiPendaftaranDto })
  @ApiResponse({
    status: 200,
    description: 'Mutasi pasien berhasil diproses.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Transisi mutasi tidak valid (mis. Ranap ke Rajal) atau payload tidak lengkap.',
  })
  @ApiResponse({
    status: 409,
    description: 'Kuota jadwal poli tujuan penuh atau bed tujuan tidak KOSONG.',
  })
  mutasi(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MutasiPendaftaranDto,
  ) {
    return this.pendaftaranService.mutasi(id, dto);
  }

  @Put(':id/penjamin')
  @RequirePermission('Pendaftaran', 'update')
  @ApiOperation({
    summary:
      'Memperbarui daftar penjamin / asuransi (termasuk skema multi-penjamin / COB) pada kunjungan aktif',
    description:
      'Mendukung perubahan cara bayar (mis. IGD UMUM menjadi BPJS + Asuransi Swasta COB) atau memperbarui nomor SEP, rujukan, serta urutan penjamin utama/sekunder.',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: UpdatePenjaminPendaftaranDto })
  @ApiResponse({
    status: 200,
    description: 'Konfigurasi penjamin kunjungan berhasil diperbarui.',
  })
  @ApiResponse({
    status: 400,
    description:
      'Payload penjamin tidak valid, terduplikasi, atau mencampur UMUM dengan asuransi lain.',
  })
  @ApiResponse({
    status: 409,
    description:
      'Kunjungan sudah tidak aktif atau kuota JKN/Non-JKN jadwal praktik tidak mencukupi.',
  })
  updatePenjamin(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePenjaminPendaftaranDto,
  ) {
    return this.pendaftaranService.updatePenjamin(id, dto);
  }

  @Post(':id/batal-ranap')
  @RequirePermission('Pendaftaran', 'update')
  @ApiOperation({
    summary:
      'Membatalkan status Rawat Inap pasien, mengosongkan bed -> KOSONG, dan mengembalikan ke unit Rajal/IGD asal (jika ada)',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: BatalRanapDto })
  @ApiResponse({
    status: 200,
    description: 'Pembatalan rawat inap berhasil diproses.',
  })
  @ApiResponse({
    status: 400,
    description: 'Kunjungan saat ini bukan berstatus Rawat Inap / Intensive.',
  })
  batalRanap(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BatalRanapDto,
  ) {
    return this.pendaftaranService.batalRanap(id, dto);
  }

  @Patch(':id/selesai')
  @RequirePermission('Pendaftaran', 'update')
  @ApiOperation({
    summary:
      'Menyelesaikan / memulangkan (discharge) pasien dan mengosongkan bed -> KOSONG',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: SelesaiPendaftaranDto })
  @ApiResponse({
    status: 200,
    description: 'Kunjungan pasien berhasil diselesaikan dan bed dikosongkan.',
  })
  selesai(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SelesaiPendaftaranDto,
  ) {
    return this.pendaftaranService.selesai(id, dto);
  }

  @Patch(':id/batal')
  @RequirePermission('Pendaftaran', 'update')
  @ApiOperation({
    summary:
      'Membatalkan kunjungan pendaftaran dan mengosongkan bed (jika ada)',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: BatalPendaftaranDto })
  @ApiResponse({
    status: 200,
    description: 'Kunjungan pendaftaran berhasil dibatalkan.',
  })
  batal(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BatalPendaftaranDto,
  ) {
    return this.pendaftaranService.batal(id, dto);
  }
}
