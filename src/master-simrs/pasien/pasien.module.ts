import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pasien } from '@entities/pasien.entity';
import { PasienPenjamin } from '@entities/pasien-penjamin.entity';
import { Penjamin } from '@entities/penjamin.entity';
import { Kelas } from '@entities/kelas.entity';
import { Penduduk } from '@entities/penduduk.entity';
import { Kelurahan } from '@entities/kelurahan.entity';
import { Tenant } from '@entities/tenant.entity';
import { TenantCounter } from '@entities/tenant-counter.entity';
import { PendudukModule } from '../penduduk/penduduk.module';
import { PenjaminModule } from '../penjamin/penjamin.module';
import { KelasModule } from '../kelas/kelas.module';
import { PasienService } from './services/pasien.service';
import { PasienController } from './controller/pasien.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Pasien,
      PasienPenjamin,
      Penjamin,
      Kelas,
      Penduduk,
      Kelurahan,
      Tenant,
      TenantCounter,
    ]),
    PendudukModule,
    PenjaminModule,
    KelasModule,
  ],
  controllers: [PasienController],
  providers: [PasienService],
  exports: [PasienService, TypeOrmModule],
})
export class PasienModule {}
