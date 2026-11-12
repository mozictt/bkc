import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JadwalDokter } from '@entities/jadwal-dokter.entity';
import { Dokter } from '@entities/dokter.entity';
import { Unit } from '@entities/unit.entity';
import { DokterModule } from '../dokter/dokter.module';
import { UnitModule } from '../unit/unit.module';
import { JadwalDokterService } from './services/jadwal-dokter.service';
import { JadwalDokterController } from './controller/jadwal-dokter.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([JadwalDokter, Dokter, Unit]),
    DokterModule,
    UnitModule,
  ],
  controllers: [JadwalDokterController],
  providers: [JadwalDokterService],
  exports: [JadwalDokterService, TypeOrmModule],
})
export class JadwalDokterModule {}

