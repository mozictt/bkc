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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { RequirePermission } from '@src/permissions/decorators/require-permission.decorator';
import { PermissionGuard } from '@src/permissions/guards/permission.guard';
import { PendudukService } from '../services/penduduk.service';
import { CreatePendudukDto } from '../dto/create-penduduk.dto';
import { UpdatePendudukDto } from '../dto/update-penduduk.dto';
import { QueryPendudukDto } from '../dto/query-penduduk.dto';

@ApiTags('Master - Penduduk')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('master/penduduk')
export class PendudukController {
  constructor(private readonly pendudukService: PendudukService) {}

  @Get()
  @RequirePermission('Penduduk', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar master data penduduk terpaginasi',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar penduduk berhasil diambil.',
  })
  findAll(@Query() queryDto: QueryPendudukDto) {
    return this.pendudukService.findAll(queryDto);
  }

  @Get('nik/:nik')
  @RequirePermission('Penduduk', 'view')
  @ApiOperation({
    summary: 'Mencari data penduduk berdasarkan NIK (16 digit)',
    description:
      'Digunakan untuk validasi dan autolengkap form pegawai, dokter, atau pasien.',
  })
  @ApiParam({
    name: 'nik',
    example: '3273011505900001',
    description: 'NIK 16 digit',
  })
  @ApiResponse({ status: 200, description: 'Data penduduk ditemukan.' })
  @ApiResponse({
    status: 404,
    description: 'Penduduk dengan NIK tersebut tidak ditemukan.',
  })
  findByNik(@Param('nik') nik: string) {
    return this.pendudukService.findByNik(nik);
  }

  @Get(':id')
  @RequirePermission('Penduduk', 'view')
  @ApiOperation({
    summary: 'Mendapatkan detail lengkap data penduduk berdasarkan ID',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Detail penduduk ditemukan.' })
  @ApiResponse({ status: 404, description: 'Data penduduk tidak ditemukan.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pendudukService.findOne(id);
  }

  @Post()
  @RequirePermission('Penduduk', 'create')
  @ApiOperation({ summary: 'Menambahkan data penduduk baru' })
  @ApiBody({ type: CreatePendudukDto })
  @ApiResponse({
    status: 201,
    description: 'Data penduduk berhasil ditambahkan.',
  })
  @ApiResponse({
    status: 409,
    description: 'NIK sudah terdaftar pada tenant yang sama.',
  })
  create(@Body() dto: CreatePendudukDto) {
    return this.pendudukService.create(dto);
  }

  @Put(':id')
  @RequirePermission('Penduduk', 'update')
  @ApiOperation({ summary: 'Memperbarui data penduduk' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: UpdatePendudukDto })
  @ApiResponse({
    status: 200,
    description: 'Data penduduk berhasil diperbarui.',
  })
  @ApiResponse({ status: 404, description: 'Data penduduk tidak ditemukan.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePendudukDto,
  ) {
    return this.pendudukService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('Penduduk', 'delete')
  @ApiOperation({ summary: 'Menghapus data penduduk (Soft Delete)' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Data penduduk berhasil dihapus.' })
  @ApiResponse({
    status: 409,
    description:
      'Data penduduk tidak dapat dihapus karena masih berelasi dengan pegawai atau dokter.',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.pendudukService.remove(id);
  }
}
