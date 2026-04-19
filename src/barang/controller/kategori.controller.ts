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
} from '@nestjs/common';
import { KategoriService } from '../services/kategori.service';
import { CreateKategoriDto } from '../dto/create-kategori.dto';
import { UpdateKategoriDto } from '../dto/update-kategori.dto';

@Controller('kategori')
export class KategoriController {
  constructor(private readonly kategoriService: KategoriService) {}

  @Get()
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
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.kategoriService.findOne(id);
  }

  @Post()
  async create(@Body() data: CreateKategoriDto) {
    return this.kategoriService.create(data);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateKategoriDto,
  ) {
    return this.kategoriService.update(id, data);
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.kategoriService.remove(id);
    return { message: 'Kategori berhasil dihapus' };
  }
}
