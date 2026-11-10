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
import { PenjaminService } from '../services/penjamin.service';
import { CreatePenjaminDto } from '../dto/create-penjamin.dto';
import { UpdatePenjaminDto } from '../dto/update-penjamin.dto';
import { QueryPenjaminDto } from '../dto/query-penjamin.dto';

@ApiTags('Master - Penjamin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('master/penjamin')
export class PenjaminController {
  constructor(private readonly penjaminService: PenjaminService) {}

  @Get()
  @RequirePermission('Penjamin', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar master data penjamin / asuransi terpaginasi',
  })
  @ApiResponse({
    status: 200,
    description: 'Daftar penjamin berhasil diambil.',
  })
  findAll(@Query() queryDto: QueryPenjaminDto) {
    return this.penjaminService.findAll(queryDto);
  }

  @Get('options')
  @RequirePermission('Penjamin', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar penjamin aktif untuk dropdown form pasien',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Cari kode atau nama penjamin',
  })
  @ApiResponse({
    status: 200,
    description: 'Opsi penjamin aktif berhasil diambil.',
  })
  findOptions(@Query('search') search = '') {
    return this.penjaminService.findOptions(search);
  }

  @Get(':id')
  @RequirePermission('Penjamin', 'view')
  @ApiOperation({
    summary: 'Mendapatkan detail master penjamin berdasarkan ID',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Detail penjamin ditemukan.' })
  @ApiResponse({ status: 404, description: 'Data penjamin tidak ditemukan.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.penjaminService.findOne(id);
  }

  @Post()
  @RequirePermission('Penjamin', 'create')
  @ApiOperation({ summary: 'Menambahkan master penjamin baru' })
  @ApiBody({ type: CreatePenjaminDto })
  @ApiResponse({
    status: 201,
    description: 'Data penjamin berhasil ditambahkan.',
  })
  @ApiResponse({
    status: 409,
    description: 'Kode atau nama penjamin sudah terdaftar.',
  })
  create(@Body() dto: CreatePenjaminDto) {
    return this.penjaminService.create(dto);
  }

  @Put(':id')
  @RequirePermission('Penjamin', 'update')
  @ApiOperation({ summary: 'Memperbarui data master penjamin' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: UpdatePenjaminDto })
  @ApiResponse({
    status: 200,
    description: 'Data penjamin berhasil diperbarui.',
  })
  @ApiResponse({ status: 404, description: 'Data penjamin tidak ditemukan.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePenjaminDto,
  ) {
    return this.penjaminService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('Penjamin', 'delete')
  @ApiOperation({ summary: 'Menghapus data master penjamin (Soft Delete)' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Data penjamin berhasil dihapus.' })
  @ApiResponse({
    status: 409,
    description:
      'Data penjamin tidak dapat dihapus karena masih digunakan oleh pasien.',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.penjaminService.remove(id);
  }
}
