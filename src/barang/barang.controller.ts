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
import { BarangService } from './barang.service';
import { Barang } from '../entities/barang.entity';
import { CreateBarangDto } from './dto/create-barang.dto';
import { UpdateBarangDto } from './dto/update-barang.dto';

@Controller('barang')
export class BarangController {
  constructor(private readonly barangService: BarangService) {}

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<Barang> {
    return this.barangService.findOne(id);
  }
  @Get()
  async findAll(@Query('page') page = 1, @Query('limit') limit = 10) {
    return this.barangService.findAll(+page, +limit);
  }

  @Post()
  async create(@Body() data: CreateBarangDto) {
    return this.barangService.create(data);
  }
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateBarangDto,
  ) {
    return this.barangService.update(id, data);
  }
  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.barangService.remove(id);
    return { message: 'Barang berhasil dihapus' };
  }
}
