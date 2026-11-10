import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Penduduk } from '@entities/penduduk.entity';
import { Agama } from '@entities/agama.entity';
import { Pendidikan } from '@entities/pendidikan.entity';
import { Pekerjaan } from '@entities/pekerjaan.entity';
import { Suku } from '@entities/suku.entity';
import { Kelurahan } from '@entities/kelurahan.entity';
import { PendudukService } from './services/penduduk.service';
import { PendudukController } from './controller/penduduk.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Penduduk,
      Agama,
      Pendidikan,
      Pekerjaan,
      Suku,
      Kelurahan,
    ]),
  ],
  controllers: [PendudukController],
  providers: [PendudukService],
  exports: [PendudukService, TypeOrmModule],
})
export class PendudukModule {}

