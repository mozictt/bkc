import { Module } from '@nestjs/common';
import { SukuModule } from './suku/suku.module';
import { PekerjaanModule } from './pekerjaan/pekerjaan.module';
import { PendidikanModule } from './pendidikan/pendidikan.module';
import { AgamaModule } from './agama/agama.module';

@Module({
  imports: [SukuModule, PekerjaanModule, PendidikanModule, AgamaModule],
})
export class MasterSimrsModule {}

