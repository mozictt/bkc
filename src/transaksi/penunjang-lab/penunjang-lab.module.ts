import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PenunjangLab } from '@entities/penunjang-lab.entity';
import { PenunjangLabItem } from '@entities/penunjang-lab-item.entity';
import { PenunjangLabHasil } from '@entities/penunjang-lab-hasil.entity';
import { Pendaftaran } from '@entities/pendaftaran.entity';
import { Unit } from '@entities/unit.entity';
import { Dokter } from '@entities/dokter.entity';
import { Pegawai } from '@entities/pegawai.entity';
import { TarifTindakan } from '@entities/tarif-tindakan.entity';
import { TarifLayanan } from '@entities/tarif-layanan.entity';
import { LabTindakanParameter } from '@entities/lab-tindakan-parameter.entity';
import { LabParameterRujukan } from '@entities/lab-parameter-rujukan.entity';
import { TenantCounter } from '@entities/tenant-counter.entity';
import { PenunjangLabService } from './services/penunjang-lab.service';
import { PenunjangLabController } from './controller/penunjang-lab.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PenunjangLab,
      PenunjangLabItem,
      PenunjangLabHasil,
      Pendaftaran,
      Unit,
      Dokter,
      Pegawai,
      TarifTindakan,
      TarifLayanan,
      LabTindakanParameter,
      LabParameterRujukan,
      TenantCounter,
    ]),
  ],
  controllers: [PenunjangLabController],
  providers: [PenunjangLabService],
  exports: [PenunjangLabService, TypeOrmModule],
})
export class PenunjangLabModule {}
