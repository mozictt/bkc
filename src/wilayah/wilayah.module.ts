import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Provinsi } from '@entities/provinsi.entity';
import { Kabupaten } from '@entities/kabupaten.entity';
import { Kecamatan } from '@entities/kecamatan.entity';
import { Kelurahan } from '@entities/kelurahan.entity';
import { WilayahService } from './wilayah.service';
import { WilayahController } from './wilayah.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Provinsi, Kabupaten, Kecamatan, Kelurahan]),
  ],
  controllers: [WilayahController],
  providers: [WilayahService],
  exports: [WilayahService],
})
export class WilayahModule {}
