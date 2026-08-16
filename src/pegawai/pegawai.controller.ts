import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
import { PegawaiService } from './pegawai.service';
import { CreatePegawaiDto } from './dto/create-pegawai.dto';
import { UpdatePegawaiDto } from './dto/update-pegawai.dto';
import { QueryPegawaiDto } from './dto/query-pegawai.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';

@ApiTags('Pegawai Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('pegawai')
export class PegawaiController {
  constructor(private readonly pegawaiService: PegawaiService) {}

  @Post()
  @RequirePermission('Pegawai', 'create')
  @ApiOperation({ summary: 'Menambahkan data Pegawai baru' })
  @ApiBody({ type: CreatePegawaiDto })
  @ApiResponse({ status: 201, description: 'Pegawai berhasil ditambahkan.' })
  create(@Body() createPegawaiDto: CreatePegawaiDto) {
    return this.pegawaiService.create(createPegawaiDto);
  }

  @Get()
  @RequirePermission('Pegawai', 'view')
  @ApiOperation({ summary: 'Mendapatkan daftar Pegawai terpaginasi' })
  findAll(@Query() queryDto: QueryPegawaiDto) {
    return this.pegawaiService.findAll(queryDto);
  }

  @Get('unassigned')
  @RequirePermission('Pegawai', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar Pegawai yang belum memiliki akun User',
    description: 'Digunakan saat administrator membuat akun User baru.',
  })
  findUnassigned() {
    return this.pegawaiService.findUnassigned();
  }

  @Get(':id')
  @RequirePermission('Pegawai', 'view')
  @ApiOperation({ summary: 'Mendapatkan detail Pegawai berdasarkan ID' })
  @ApiResponse({ status: 200, description: 'Detail pegawai ditemukan.' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pegawaiService.findOne(id);
  }

  @Put(':id')
  @RequirePermission('Pegawai', 'update')
  @ApiOperation({ summary: 'Memperbarui data Pegawai' })
  @ApiBody({ type: UpdatePegawaiDto })
  @ApiResponse({ status: 200, description: 'Data pegawai berhasil diperbarui.' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePegawaiDto: UpdatePegawaiDto,
  ) {
    return this.pegawaiService.update(id, updatePegawaiDto);
  }

  @Delete(':id')
  @RequirePermission('Pegawai', 'delete')
  @ApiOperation({ summary: 'Menghapus data Pegawai (Soft Delete)' })
  @ApiResponse({ status: 200, description: 'Pegawai berhasil dihapus.' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.pegawaiService.remove(id);
  }
}
