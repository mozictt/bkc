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
import { KelasService } from '../services/kelas.service';
import { CreateKelasDto } from '../dto/create-kelas.dto';
import { UpdateKelasDto } from '../dto/update-kelas.dto';
import { QueryKelasDto } from '../dto/query-kelas.dto';

@ApiTags('Master - Kelas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('master/kelas')
export class KelasController {
  constructor(private readonly kelasService: KelasService) {}

  @Get()
  @RequirePermission('Kelas', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar master kelas perawatan terpaginasi',
  })
  @ApiResponse({ status: 200, description: 'Daftar kelas berhasil diambil.' })
  findAll(@Query() queryDto: QueryKelasDto) {
    return this.kelasService.findAll(queryDto);
  }

  @Get('options')
  @RequirePermission('Kelas', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar kelas aktif untuk dropdown form unit atau bed',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Cari kode atau nama kelas',
  })
  @ApiResponse({
    status: 200,
    description: 'Opsi kelas aktif berhasil diambil.',
  })
  findOptions(@Query('search') search = '') {
    return this.kelasService.findOptions(search);
  }

  @Get(':id')
  @RequirePermission('Kelas', 'view')
  @ApiOperation({ summary: 'Mendapatkan detail master kelas berdasarkan ID' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Detail kelas ditemukan.' })
  @ApiResponse({ status: 404, description: 'Data kelas tidak ditemukan.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.kelasService.findOne(id);
  }

  @Post()
  @RequirePermission('Kelas', 'create')
  @ApiOperation({ summary: 'Menambahkan master kelas baru' })
  @ApiBody({ type: CreateKelasDto })
  @ApiResponse({ status: 201, description: 'Data kelas berhasil ditambahkan.' })
  @ApiResponse({
    status: 409,
    description: 'Kode atau nama kelas sudah terdaftar.',
  })
  create(@Body() dto: CreateKelasDto) {
    return this.kelasService.create(dto);
  }

  @Put(':id')
  @RequirePermission('Kelas', 'update')
  @ApiOperation({ summary: 'Memperbarui data master kelas' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: UpdateKelasDto })
  @ApiResponse({ status: 200, description: 'Data kelas berhasil diperbarui.' })
  @ApiResponse({ status: 404, description: 'Data kelas tidak ditemukan.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateKelasDto) {
    return this.kelasService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('Kelas', 'delete')
  @ApiOperation({ summary: 'Menghapus data master kelas' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Data kelas berhasil dihapus.' })
  @ApiResponse({
    status: 409,
    description: 'Data kelas masih digunakan oleh unit atau bed.',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.kelasService.remove(id);
  }
}
