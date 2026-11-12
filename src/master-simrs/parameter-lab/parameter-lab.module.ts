import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LabParameter } from '@entities/lab-parameter.entity';
import { LabParameterRujukan } from '@entities/lab-parameter-rujukan.entity';
import { LabTindakanParameter } from '@entities/lab-tindakan-parameter.entity';
import { TarifTindakan } from '@entities/tarif-tindakan.entity';
import { ParameterLabService } from './services/parameter-lab.service';
import { ParameterLabController } from './controller/parameter-lab.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LabParameter,
      LabParameterRujukan,
      LabTindakanParameter,
      TarifTindakan,
    ]),
  ],
  controllers: [ParameterLabController],
  providers: [ParameterLabService],
  exports: [ParameterLabService, TypeOrmModule],
})
export class ParameterLabModule {}
