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
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { CheckPermission } from '../../auth/decorators/permissions.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('kategori')
export class KategoriController {
  constructor(private readonly kategoriService: KategoriService) {}

  @Get()
  @CheckPermission(['manage', 'view'], 'Kategori')
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
  @CheckPermission(['manage', 'view'], 'Kategori')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.kategoriService.findOne(id);
  }

  @Post()
  @CheckPermission(['manage', 'create'], 'Kategori')
  async create(@Body() data: CreateKategoriDto) {
    return this.kategoriService.create(data);
  }

  @Put(':id')
  @CheckPermission(['manage', 'update'], 'Kategori')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateKategoriDto,
  ) {
    return this.kategoriService.update(id, data);
  }

  @Delete(':id')
  @CheckPermission(['manage', 'delete'], 'Kategori')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.kategoriService.remove(id);
    return { message: 'Kategori berhasil dihapus' };
  }
}
