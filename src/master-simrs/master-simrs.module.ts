import { Module } from '@nestjs/common';
import { SukuModule } from './suku/suku.module';
import { PekerjaanModule } from './pekerjaan/pekerjaan.module';
import { PendidikanModule } from './pendidikan/pendidikan.module';
import { AgamaModule } from './agama/agama.module';
import { PendudukModule } from './penduduk/penduduk.module';
import { DokterModule } from './dokter/dokter.module';
import { PenjaminModule } from './penjamin/penjamin.module';
import { PasienModule } from './pasien/pasien.module';
import { KelasModule } from './kelas/kelas.module';
import { UnitModule } from './unit/unit.module';
import { BedModule } from './bed/bed.module';

@Module({
  imports: [
    SukuModule,
    PekerjaanModule,
    PendidikanModule,
    AgamaModule,
    PendudukModule,
    DokterModule,
    PenjaminModule,
    PasienModule,
    KelasModule,
    UnitModule,
    BedModule,
  ],
})
export class MasterSimrsModule {}
