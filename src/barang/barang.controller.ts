import { Controller, Get, Post, Put, Delete, Body, Param, ParseIntPipe,Query,UseGuards } from '@nestjs/common';
import { BarangService } from './barang.service';
import { Barang } from './barang.entity';
import { CreateBarangDto } from './dto/create-barang.dto';
import { UpdateBarangDto } from './dto/update-barang.dto';
import { AuthGuard } from '@nestjs/passport';

@Controller('barang')
export class BarangController {
    constructor(private readonly barangService: BarangService) { }

    // @Get()
    // async findAll(): Promise<Barang[]> {
    //     return this.barangService.findAll();
    // }
     @UseGuards(AuthGuard('jwt'))
    @Get(':id')
    async findOne(@Param('id', ParseIntPipe) id: number): Promise<Barang> {
        return this.barangService.findOne(id);
    }

    //   @Post()
    //   async create(@Body() data: Partial<Barang>): Promise<Barang> {
    //     return this.barangService.create(data);
    //   }

    //   @Put(':id')
    //   async update(@Param('id', ParseIntPipe) id: number, @Body() data: Partial<Barang>): Promise<Barang> {
    //     return this.barangService.update(id, data);
    //   }
     @UseGuards(AuthGuard('jwt'))
    @Get()
    async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    ) {
    return this.barangService.findAll(+page, +limit);
    }

     @UseGuards(AuthGuard('jwt'))
    @Post()
    async create(@Body() data: CreateBarangDto) {
        return this.barangService.create(data);
    }

  @UseGuards(AuthGuard('jwt'))
  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateBarangDto,
  ) {
    return this.barangService.update(id, data);
  }

     @UseGuards(AuthGuard('jwt'))
    @Delete(':id')
    async remove(@Param('id', ParseIntPipe) id: number): Promise<{ message: string }> {
        await this.barangService.remove(id);
        return { message: 'Barang berhasil dihapus' };
    }
}
