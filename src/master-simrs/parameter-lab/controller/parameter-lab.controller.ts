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
import { ParameterLabService } from '../services/parameter-lab.service';
import {
  CreateLabParameterDto,
  QueryLabParameterDto,
  QuickAddParameterToTindakanDto,
  SaveTindakanParameterMappingDto,
  UpdateLabParameterDto,
} from '../dto/parameter-lab.dto';

@ApiTags('Master - Parameter Lab')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('master/parameter-lab')
export class ParameterLabController {
  constructor(private readonly service: ParameterLabService) {}

  @Get()
  @RequirePermission('Parameter Lab', 'view')
  @ApiOperation({
    summary:
      'Mendapatkan daftar master parameter pemeriksaan laboratorium terpaginasi beserta nilai rujukan',
  })
  @ApiResponse({ status: 200, description: 'Daftar parameter lab berhasil diambil.' })
  findAll(@Query() queryDto: QueryLabParameterDto) {
    return this.service.findAll(queryDto);
  }

  @Get('options')
  @RequirePermission('Parameter Lab', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar opsi parameter lab aktif beserta nilai rujukan',
  })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'grup', required: false })
  findOptions(@Query('search') search = '', @Query('grup') grup = '') {
    return this.service.findOptions(search, grup);
  }

  @Get('tindakan-overview')
  @RequirePermission('Parameter Lab', 'view')
  @ApiOperation({
    summary:
      'Mendapatkan daftar item Tarif Tindakan kategori LABORATORIUM beserta jumlah parameter terhubung',
  })
  @ApiQuery({ name: 'search', required: false })
  getLabTindakanOverview(@Query('search') search = '') {
    return this.service.getLabTindakanOverview(search);
  }

  @Get('tindakan/:tindakanId/mapping')
  @RequirePermission('Parameter Lab', 'view')
  @ApiOperation({
    summary:
      'Mendapatkan daftar parameter pemeriksaan yang terpetakan pada satu tindakan tarif Lab (mis: Darah Lengkap)',
  })
  @ApiParam({ name: 'tindakanId', type: Number, example: 1 })
  getMappingByTindakan(@Param('tindakanId', ParseIntPipe) tindakanId: number) {
    return this.service.getMappingByTindakan(tindakanId);
  }

  @Put('tindakan/:tindakanId/mapping')
  @RequirePermission('Parameter Lab', 'update')
  @ApiOperation({
    summary:
      'Menyimpan daftar dan urutan parameter pemeriksaan yang termasuk dalam satu tindakan tarif Lab',
  })
  @ApiParam({ name: 'tindakanId', type: Number, example: 1 })
  @ApiBody({ type: SaveTindakanParameterMappingDto })
  saveMappingForTindakan(
    @Param('tindakanId', ParseIntPipe) tindakanId: number,
    @Body() dto: SaveTindakanParameterMappingDto,
  ) {
    return this.service.saveMappingForTindakan(tindakanId, dto);
  }

  @Post('tindakan/:tindakanId/quick-add')
  @RequirePermission('Parameter Lab', 'create')
  @ApiOperation({
    summary:
      'Membuat parameter lab baru beserta nilai rujukan lalu langsung menghubungkannya ke tindakan tarif Lab',
  })
  @ApiParam({ name: 'tindakanId', type: Number, example: 1 })
  @ApiBody({ type: QuickAddParameterToTindakanDto })
  quickAddToTindakan(
    @Param('tindakanId', ParseIntPipe) tindakanId: number,
    @Body() dto: QuickAddParameterToTindakanDto,
  ) {
    return this.service.quickAddToTindakan(tindakanId, dto);
  }

  @Get(':id')
  @RequirePermission('Parameter Lab', 'view')
  @ApiOperation({
    summary: 'Mendapatkan detail parameter lab beserta daftar nilai rujukannya',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission('Parameter Lab', 'create')
  @ApiOperation({ summary: 'Menambahkan master parameter lab baru beserta rujukan' })
  @ApiBody({ type: CreateLabParameterDto })
  create(@Body() dto: CreateLabParameterDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @RequirePermission('Parameter Lab', 'update')
  @ApiOperation({ summary: 'Memperbarui master parameter lab dan nilai rujukan' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: UpdateLabParameterDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLabParameterDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('Parameter Lab', 'delete')
  @ApiOperation({ summary: 'Menghapus master parameter lab' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
