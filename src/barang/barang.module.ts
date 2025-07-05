import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Barang } from './barang.entity';
import { BarangService } from './barang.service';
import { BarangController } from './barang.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Barang])],
  controllers: [BarangController],
  providers: [BarangService],
})
export class BarangModule {}
