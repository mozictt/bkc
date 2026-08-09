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
  UseInterceptors,
} from '@nestjs/common';
import { KategoriService } from '../services/kategori.service';
import { CreateKategoriDto } from '../dto/create-kategori.dto';
import { UpdateKategoriDto } from '../dto/update-kategori.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { RequirePermission } from '../../permissions/decorators/require-permission.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Kategori')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('kategori')
export class KategoriController {
  constructor(private readonly kategoriService: KategoriService) {}

  @Get()
  @RequirePermission('Kategori', 'view')
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search = '',
    @Query('sortBy') sortBy = 'id',
    @Query('sortType') sortType = 'desc',
  ) {
    return this.kategoriService.findAll(
      +page,
      +limit,
      search,
      sortBy,
      sortType,
    );
  }

  @Get(':id')
  @RequirePermission('Kategori', 'view')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.kategoriService.findOne(id);
  }

  @Post()
  @RequirePermission('Kategori', 'create')
  async create(@Body() data: CreateKategoriDto) {
    return this.kategoriService.create(data);
  }

  @Put(':id')
  @RequirePermission('Kategori', 'update')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateKategoriDto,
  ) {
    return this.kategoriService.update(id, data);
  }

  @Delete(':id')
  @RequirePermission('Kategori', 'delete')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.kategoriService.remove(id);
    return { message: 'Kategori berhasil dihapus' };
  }
}
