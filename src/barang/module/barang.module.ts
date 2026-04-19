import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Barang } from '../../entities/barang.entity';
import { KategoriBarang } from '@entities/kategori-barang.entity';
import { BarangService } from '../services/barang.service';
import { BarangController } from '../controller/barang.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Barang, KategoriBarang])],
  controllers: [BarangController],
  providers: [BarangService],
})
export class BarangModule {}
