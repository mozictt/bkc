import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Barang } from '../entities/barang.entity';
import { KategoriBarang } from '@entities/kategori-barang.entity';
import { BarangService } from './barang.service';
import { BarangController } from './barang.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Barang, KategoriBarang])],
  controllers: [BarangController],
  providers: [BarangService],
})
export class BarangModule {}
