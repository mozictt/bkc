import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dokter } from '@entities/dokter.entity';
import { Pegawai } from '@entities/pegawai.entity';
import { Penduduk } from '@entities/penduduk.entity';
import { PegawaiModule } from '@src/pegawai/pegawai.module';
import { PendudukModule } from '../penduduk/penduduk.module';
import { DokterService } from './services/dokter.service';
import { DokterController } from './controller/dokter.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Dokter, Pegawai, Penduduk]),
    PendudukModule,
    PegawaiModule,
  ],
  controllers: [DokterController],
  providers: [DokterService],
  exports: [DokterService, TypeOrmModule],
})
export class DokterModule {}

