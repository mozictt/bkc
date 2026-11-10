import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pegawai } from '../entities/pegawai.entity';
import { User } from '../entities/user.entity';
import { Penduduk } from '../entities/penduduk.entity';
import { Dokter } from '../entities/dokter.entity';
import { Kelurahan } from '../entities/kelurahan.entity';
import { PegawaiService } from './pegawai.service';
import { PegawaiController } from './pegawai.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pegawai, User, Penduduk, Dokter, Kelurahan]),
  ],
  controllers: [PegawaiController],
  providers: [PegawaiService],
  exports: [PegawaiService, TypeOrmModule],
})
export class PegawaiModule {}
