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
import { PenunjangLabService } from '../services/penunjang-lab.service';
import {
  BatalPenunjangLabDto,
  CreatePenunjangLabDto,
  PreviewTindakanLabDto,
  QueryEligibleKunjunganDto,
  QueryPenunjangLabDto,
  SaveHasilPenunjangLabDto,
  VerifyPenunjangLabDto,
} from '../dto/penunjang-lab.dto';

@ApiTags('Transaksi - Penunjang Lab')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('transaksi/penunjang-lab')
export class PenunjangLabController {
  constructor(private readonly service: PenunjangLabService) {}

  @Get()
  @RequirePermission('Penunjang Lab', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar transaksi & hasil penunjang laboratorium terpaginasi',
  })
  findAll(@Query() queryDto: QueryPenunjangLabDto) {
    return this.service.findAll(queryDto);
  }

  @Get('kunjungan-eligible')
  @RequirePermission('Penunjang Lab', 'view')
  @ApiOperation({
    summary:
      'Mendapatkan daftar kunjungan pasien yang masih diperiksa atau belum lunas bayar (siap input penunjang lab)',
  })
  findEligibleKunjungan(@Query() queryDto: QueryEligibleKunjunganDto) {
    return this.service.findEligibleKunjungan(queryDto);
  }

  @Get('preview-tindakan')
  @RequirePermission('Penunjang Lab', 'view')
  @ApiOperation({
    summary:
      'Menghitung preview tarif (Unit -> Penjamin -> Kelas) beserta daftar parameter & nilai rujukan sesuai profil pasien',
  })
  previewTindakan(@Query() queryDto: PreviewTindakanLabDto) {
    return this.service.previewTindakanForKunjungan(queryDto);
  }

  @Get(':id')
  @RequirePermission('Penunjang Lab', 'view')
  @ApiOperation({
    summary:
      'Mendapatkan detail order penunjang lab beserta seluruh parameter hasil pemeriksaan',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission('Penunjang Lab', 'create')
  @ApiOperation({
    summary:
      'Membuat order penunjang lab untuk pasien yang masih diperiksa/belum bayar (bisa langsung sekalian input hasil)',
  })
  @ApiBody({ type: CreatePenunjangLabDto })
  @ApiResponse({ status: 201, description: 'Transaksi penunjang lab berhasil disimpan.' })
  create(@Body() dto: CreatePenunjangLabDto) {
    return this.service.create(dto);
  }

  @Put(':id/hasil')
  @RequirePermission('Penunjang Lab', 'update')
  @ApiOperation({
    summary:
      'Menginput atau memperbarui nilai hasil parameter pemeriksaan laboratorium beserta evaluasi nilai normal/kritis',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: SaveHasilPenunjangLabDto })
  saveHasil(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SaveHasilPenunjangLabDto,
  ) {
    return this.service.saveHasil(id, dto);
  }

  @Patch(':id/verifikasi')
  @RequirePermission('Penunjang Lab', 'update')
  @ApiOperation({
    summary: 'Memverifikasi & mengunci hasil pemeriksaan laboratorium',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: VerifyPenunjangLabDto })
  verify(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VerifyPenunjangLabDto,
  ) {
    return this.service.verify(id, dto);
  }

  @Patch(':id/batal')
  @RequirePermission('Penunjang Lab', 'update')
  @ApiOperation({
    summary: 'Membatalkan transaksi penunjang laboratorium yang belum diverifikasi',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiBody({ type: BatalPenunjangLabDto })
  batal(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BatalPenunjangLabDto,
  ) {
    return this.service.batal(id, dto);
  }
}
