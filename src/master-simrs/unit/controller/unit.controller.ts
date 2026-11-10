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
import { JenisUnit } from '../../constants/simrs.enum';
import { UnitService } from '../services/unit.service';
import { CreateUnitDto } from '../dto/create-unit.dto';
import { UpdateUnitDto } from '../dto/update-unit.dto';
import { QueryUnitDto } from '../dto/query-unit.dto';

@ApiTags('Master - Unit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('master/unit')
export class UnitController {
  constructor(private readonly unitService: UnitService) {}

  @Get()
  @RequirePermission('Unit', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar master unit pelayanan terpaginasi',
  })
  @ApiResponse({ status: 200, description: 'Daftar unit berhasil diambil.' })
  findAll(@Query() queryDto: QueryUnitDto) {
    return this.unitService.findAll(queryDto);
  }

  @Get('options')
  @RequirePermission('Unit', 'view')
  @ApiOperation({
    summary:
      'Mendapatkan daftar unit aktif untuk dropdown form bed atau jadwal',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: 'Cari kode atau nama unit',
  })
  @ApiQuery({
    name: 'jenisUnit',
    required: false,
    enum: JenisUnit,
    description: 'Filter jenis unit',
  })
  @ApiQuery({
    name: 'isTersediaBed',
    required: false,
    type: Boolean,
    description: 'Filter unit yang memiliki tempat tidur (true/false)',
  })
  @ApiResponse({
    status: 200,
    description: 'Opsi unit aktif berhasil diambil.',
  })
  findOptions(
    @Query('search') search = '',
    @Query('jenisUnit') jenisUnit?: JenisUnit,
    @Query('isTersediaBed') isTersediaBed?: string,
  ) {
    const parsedBedFlag =
      isTersediaBed === 'true'
        ? true
        : isTersediaBed === 'false'
          ? false
          : undefined;
    return this.unitService.findOptions(search, jenisUnit, parsedBedFlag);
  }

  @Get(':id')
  @RequirePermission('Unit', 'view')
  @ApiOperation({ summary: 'Mendapatkan detail master unit berdasarkan ID' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Detail unit ditemukan.' })
  @ApiResponse({ status: 404, description: 'Data unit tidak ditemukan.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.unitService.findOne(id);
  }

  @Post()
  @RequirePermission('Unit', 'create')
  @ApiOperation({ summary: 'Menambahkan master unit baru' })
  @ApiBody({ type: CreateUnitDto })
  @ApiResponse({ status: 201, description: 'Data unit berhasil ditambahkan.' })
  @ApiResponse({
    status: 409,
    description: 'Kode atau nama unit sudah terdaftar.',
  })
  create(@Body() dto: CreateUnitDto) {
    return this.unitService.create(dto);
  }

  @Put(':id')
  @RequirePermission('Unit', 'update')
  @ApiOperation({ summary: 'Memperbarui data master unit' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: UpdateUnitDto })
  @ApiResponse({ status: 200, description: 'Data unit berhasil diperbarui.' })
  @ApiResponse({ status: 404, description: 'Data unit tidak ditemukan.' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateUnitDto) {
    return this.unitService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('Unit', 'delete')
  @ApiOperation({ summary: 'Menghapus data master unit' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiResponse({ status: 200, description: 'Data unit berhasil dihapus.' })
  @ApiResponse({
    status: 409,
    description: 'Data unit masih memiliki sub-unit atau data bed.',
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.unitService.remove(id);
  }
}
