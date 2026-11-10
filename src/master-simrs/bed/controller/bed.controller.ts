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
import { BedService } from '../services/bed.service';
import {
  CreateBedDto,
  UpdateStatusKetersediaanBedDto,
} from '../dto/create-bed.dto';
import { UpdateBedDto } from '../dto/update-bed.dto';
import { QueryBedDto } from '../dto/query-bed.dto';

@ApiTags('Master - Bed')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('master/bed')
export class BedController {
  constructor(private readonly bedService: BedService) {}

  @Get()
  @RequirePermission('Bed', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar master tempat tidur (bed) terpaginasi',
  })
  @ApiResponse({ status: 200, description: 'Daftar bed berhasil diambil.' })
  findAll(@Query() queryDto: QueryBedDto) {
    return this.bedService.findAll(queryDto);
  }

  @Get('options')
  @RequirePermission('Bed', 'view')
  @ApiOperation({
    summary:
      'Mendapatkan daftar tempat tidur yang kosong untuk admisi rawat inap/IGD',
  })
  @ApiQuery({ name: 'unitId', required: false, type: Number })
  @ApiQuery({ name: 'kelasId', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Daftar bed tersedia berhasil diambil.',
  })
  findAvailableOptions(
    @Query('unitId') unitId?: string,
    @Query('kelasId') kelasId?: string,
  ) {
    const parsedUnitId = unitId ? Number(unitId) : undefined;
    const parsedKelasId = kelasId ? Number(kelasId) : undefined;
    return this.bedService.findAvailableOptions(
      Number.isFinite(parsedUnitId) ? parsedUnitId : undefined,
      Number.isFinite(parsedKelasId) ? parsedKelasId : undefined,
    );
  }

  @Get('summary')
  @RequirePermission('Bed', 'view')
  @ApiOperation({
    summary:
      'Mendapatkan rekapitulasi ketersediaan tempat tidur per Unit dan Kelas',
  })
  @ApiResponse({
    status: 200,
    description: 'Rekap ketersediaan bed berhasil diambil.',
  })
  getAvailabilitySummary() {
    return this.bedService.getAvailabilitySummary();
  }

  @Get(':id')
  @RequirePermission('Bed', 'view')
  @ApiOperation({ summary: 'Mendapatkan detail master bed berdasarkan ID' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Detail bed ditemukan.' })
  @ApiResponse({ status: 404, description: 'Data bed tidak ditemukan.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.bedService.findOne(id);
  }

  @Post()
  @RequirePermission('Bed', 'create')
  @ApiOperation({ summary: 'Menambahkan master tempat tidur (bed) baru' })
  @ApiBody({ type: CreateBedDto })
  @ApiResponse({ status: 201, description: 'Data bed berhasil ditambahkan.' })
  @ApiResponse({
    status: 400,
    description: 'Unit tidak mendukung bed atau referensi tidak valid.',
  })
  @ApiResponse({
    status: 409,
    description: 'Kode bed atau nama bed di kamar tersebut sudah terdaftar.',
  })
  create(@Body() dto: CreateBedDto) {
    return this.bedService.create(dto);
  }

  @Put(':id')
  @RequirePermission('Bed', 'update')
  @ApiOperation({ summary: 'Memperbarui data master tempat tidur (bed)' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: UpdateBedDto })
  @ApiResponse({ status: 200, description: 'Data bed berhasil diperbarui.' })
  @ApiResponse({ status: 404, description: 'Data bed tidak ditemukan.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBedDto) {
    return this.bedService.update(id, dto);
  }

  @Patch(':id/status-ketersediaan')
  @RequirePermission('Bed', 'update')
  @ApiOperation({
    summary:
      'Mengubah status ketersediaan tempat tidur (KOSONG/TERISI/BOOKING/PEMBERSIHAN/PERBAIKAN)',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: UpdateStatusKetersediaanBedDto })
  @ApiResponse({
    status: 200,
    description: 'Status ketersediaan bed berhasil diperbarui.',
  })
  updateStatusKetersediaan(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatusKetersediaanBedDto,
  ) {
    return this.bedService.updateStatusKetersediaan(id, dto);
  }

  @Delete(':id')
  @RequirePermission('Bed', 'delete')
  @ApiOperation({ summary: 'Menghapus data master bed' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Data bed berhasil dihapus.' })
  @ApiResponse({
    status: 409,
    description: 'Bed sedang terisi atau masih digunakan pada data rawat inap.',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.bedService.remove(id);
  }
}
