import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KategoriBarang } from '@entities/kategori-barang.entity';
import { KategoriService } from '../services/kategori.service';
import { KategoriController } from '../controller/kategori.controller';

@Module({
  imports: [TypeOrmModule.forFeature([KategoriBarang])],
  controllers: [KategoriController],
  providers: [KategoriService],
})
export class KategoriModule {}
