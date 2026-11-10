import { Module } from '@nestjs/common';
import { SukuModule } from './suku/suku.module';
import { PekerjaanModule } from './pekerjaan/pekerjaan.module';
import { PendidikanModule } from './pendidikan/pendidikan.module';
import { AgamaModule } from './agama/agama.module';
import { PendudukModule } from './penduduk/penduduk.module';
import { DokterModule } from './dokter/dokter.module';
import { PenjaminModule } from './penjamin/penjamin.module';
import { PasienModule } from './pasien/pasien.module';

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
  ],
})
export class MasterSimrsModule {}
