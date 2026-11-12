import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pendaftaran } from '@entities/pendaftaran.entity';
import { PendaftaranUnitHistory } from '@entities/pendaftaran-unit-history.entity';
import { PendaftaranPenjamin } from '@entities/pendaftaran-penjamin.entity';
import { Pasien } from '@entities/pasien.entity';
import { PasienPenjamin } from '@entities/pasien-penjamin.entity';
import { Penjamin } from '@entities/penjamin.entity';
import { Unit } from '@entities/unit.entity';
import { Dokter } from '@entities/dokter.entity';
import { JadwalDokter } from '@entities/jadwal-dokter.entity';
import { Bed } from '@entities/bed.entity';
import { Kelas } from '@entities/kelas.entity';
import { TenantCounter } from '@entities/tenant-counter.entity';
import { PasienModule } from '@src/master-simrs/pasien/pasien.module';
import { PendaftaranService } from './services/pendaftaran.service';
import { PendaftaranController } from './controller/pendaftaran.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Pendaftaran,
      PendaftaranUnitHistory,
      PendaftaranPenjamin,
      Pasien,
      PasienPenjamin,
      Penjamin,
      Unit,
      Dokter,
      JadwalDokter,
      Bed,
      Kelas,
      TenantCounter,
    ]),
    PasienModule,
  ],
  controllers: [PendaftaranController],
  providers: [PendaftaranService],
  exports: [PendaftaranService, TypeOrmModule],
})
export class PendaftaranModule {}

