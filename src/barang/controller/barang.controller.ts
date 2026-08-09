import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BarangService } from '../services/barang.service';
import { Barang } from '../../entities/barang.entity';
import { CreateBarangDto } from '../dto/create-barang.dto';
import { UpdateBarangDto } from '../dto/update-barang.dto';
import { CreateBulkBarangDto } from '../dto/create-bulk-barang.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RequirePermission } from '../../permissions/decorators/require-permission.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Barang')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('barang')
export class BarangController {
  constructor(private readonly barangService: BarangService) {}

  @Get(':id')
  @RequirePermission('Barang', 'view')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Barang> {
    return this.barangService.findOne(id);
  }

  @Get()
  @RequirePermission('Barang', 'view')
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search = '',
    @Query('sortBy') sortBy = 'id',
    @Query('sortType') sortType = 'desc',
  ) {
    return this.barangService.findAll(+page, +limit, search, sortBy, sortType);
  }

  @Post()
  @RequirePermission('Barang', 'create')
  async create(@Body() data: CreateBarangDto) {
    return this.barangService.create(data);
  }

  @Post('bulk')
  @RequirePermission('Barang', 'create')
  async createBulk(@Body() body: CreateBulkBarangDto) {
    const result = await this.barangService.createBulk(body);
    return {
      success: true,
      statusCode: 201,
      message: 'Bulk insert berhasil',
      data: result,
    };
  }

  @Put(':id')
  @RequirePermission('Barang', 'update')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateBarangDto,
  ) {
    return this.barangService.update(id, data);
  }

  @Delete(':id')
  @RequirePermission('Barang', 'delete')
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.barangService.remove(id);
    return { message: 'Barang berhasil dihapus' };
  }
}
