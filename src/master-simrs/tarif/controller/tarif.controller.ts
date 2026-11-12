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
import { JenisTarif } from '../../constants/simrs.enum';
import { TarifService } from '../services/tarif.service';
import { CreateTarifTindakanDto } from '../dto/create-tarif-tindakan.dto';
import { UpdateTarifTindakanDto } from '../dto/update-tarif-tindakan.dto';
import { QueryTarifDto, ResolveTarifDto } from '../dto/query-tarif.dto';
import {
  BulkCreateTarifLayananDto,
  CreateTarifLayananDto,
  UpdateTarifLayananDto,
} from '../dto/tarif-layanan.dto';

@ApiTags('Master - Tarif')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('master/tarif')
export class TarifController {
  constructor(private readonly tarifService: TarifService) {}

  @Get()
  @RequirePermission('Tarif', 'view')
  @ApiOperation({
    summary:
      'Mendapatkan daftar master tarif tindakan (Biasa, Lab, Radiologi) terpaginasi beserta rentang harga',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar master tarif tindakan berhasil diambil.',
  })
  findAll(@Query() queryDto: QueryTarifDto) {
    return this.tarifService.findAll(queryDto);
  }

  @Get('options')
  @RequirePermission('Tarif', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar opsi tindakan aktif untuk dropdown billing/order',
  })
  @ApiQuery({ name: 'search', required: false, description: 'Cari kode/nama tindakan' })
  @ApiQuery({ name: 'jenisTarif', required: false, enum: JenisTarif })
  @ApiResponse({ status: 200, description: 'Opsi tarif aktif berhasil diambil.' })
  findOptions(
    @Query('search') search = '',
    @Query('jenisTarif') jenisTarif?: JenisTarif,
  ) {
    return this.tarifService.findOptions(search, jenisTarif);
  }

  @Get('resolve')
  @RequirePermission('Tarif', 'view')
  @ApiOperation({
    summary:
      'Mencari tarif efektif berdasarkan prioritas Unit -> Penjamin -> Kelas (fallback aturan umum)',
  })
  @ApiResponse({
    status: 200,
    description: 'Hasil resolusi tarif dan rincian jasa dokter/nakes berhasil dihitung.',
  })
  resolveTarif(@Query() queryDto: ResolveTarifDto) {
    return this.tarifService.resolveTarif(queryDto);
  }

  @Get(':id')
  @RequirePermission('Tarif', 'view')
  @ApiOperation({
    summary:
      'Mendapatkan detail master tindakan beserta seluruh matriks aturan tarif (Unit x Penjamin x Kelas)',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Detail master tarif ditemukan.' })
  @ApiResponse({ status: 404, description: 'Master tarif tidak ditemukan.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tarifService.findOne(id);
  }

  @Post()
  @RequirePermission('Tarif', 'create')
  @ApiOperation({
    summary: 'Menambahkan katalog master tarif tindakan baru (Biasa/Lab/Radiologi)',
  })
  @ApiBody({ type: CreateTarifTindakanDto })
  @ApiResponse({
    status: 201,
    description: 'Master tarif tindakan berhasil ditambahkan.',
  })
  @ApiResponse({
    status: 409,
    description: 'Kode atau nama tindakan sudah terdaftar pada kategori tersebut.',
  })
  create(@Body() dto: CreateTarifTindakanDto) {
    return this.tarifService.create(dto);
  }

  @Put(':id')
  @RequirePermission('Tarif', 'update')
  @ApiOperation({ summary: 'Memperbarui katalog master tarif tindakan' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: UpdateTarifTindakanDto })
  @ApiResponse({ status: 200, description: 'Master tarif berhasil diperbarui.' })
  @ApiResponse({ status: 404, description: 'Master tarif tidak ditemukan.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTarifTindakanDto,
  ) {
    return this.tarifService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('Tarif', 'delete')
  @ApiOperation({ summary: 'Menghapus katalog master tarif tindakan' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Master tarif berhasil dihapus.' })
  @ApiResponse({
    status: 409,
    description: 'Tarif masih digunakan pada transaksi.',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tarifService.remove(id);
  }

  @Post(':id/harga')
  @RequirePermission('Tarif', 'create')
  @ApiOperation({
    summary:
      'Menambahkan aturan matriks harga untuk kombinasi Unit, Penjamin, dan Kelas (beserta Jasa Dokter & Nakes)',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: CreateTarifLayananDto })
  @ApiResponse({ status: 201, description: 'Aturan harga berhasil ditambahkan.' })
  @ApiResponse({
    status: 409,
    description: 'Kombinasi aturan harga aktif pada periode tanggal ini sudah ada.',
  })
  createHarga(
    @Param('id', ParseIntPipe) tindakanId: number,
    @Body() dto: CreateTarifLayananDto,
  ) {
    return this.tarifService.createHarga(tindakanId, dto);
  }

  @Post(':id/harga/bulk')
  @RequirePermission('Tarif', 'create')
  @ApiOperation({
    summary:
      'Generate aturan harga sekaligus untuk beberapa kombinasi Unit x Penjamin x Kelas',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: BulkCreateTarifLayananDto })
  @ApiResponse({
    status: 201,
    description: 'Aturan matriks harga massal berhasil diproses.',
  })
  bulkCreateHarga(
    @Param('id', ParseIntPipe) tindakanId: number,
    @Body() dto: BulkCreateTarifLayananDto,
  ) {
    return this.tarifService.bulkCreateHarga(tindakanId, dto);
  }

  @Put('harga/:hargaId')
  @RequirePermission('Tarif', 'update')
  @ApiOperation({
    summary: 'Memperbarui nominal jasa atau dimensi Unit/Penjamin/Kelas aturan tarif',
  })
  @ApiParam({ name: 'hargaId', type: Number, example: 10 })
  @ApiBody({ type: UpdateTarifLayananDto })
  @ApiResponse({ status: 200, description: 'Aturan harga berhasil diperbarui.' })
  updateHarga(
    @Param('hargaId', ParseIntPipe) hargaId: number,
    @Body() dto: UpdateTarifLayananDto,
  ) {
    return this.tarifService.updateHarga(hargaId, dto);
  }

  @Delete('harga/:hargaId')
  @RequirePermission('Tarif', 'delete')
  @ApiOperation({ summary: 'Menghapus satu baris aturan matriks tarif' })
  @ApiParam({ name: 'hargaId', type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Aturan harga berhasil dihapus.' })
  removeHarga(@Param('hargaId', ParseIntPipe) hargaId: number) {
    return this.tarifService.removeHarga(hargaId);
  }
}
