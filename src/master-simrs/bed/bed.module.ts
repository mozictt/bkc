import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Bed } from '@entities/bed.entity';
import { Unit } from '@entities/unit.entity';
import { Kelas } from '@entities/kelas.entity';
import { Pendaftaran } from '@entities/pendaftaran.entity';
import { UnitModule } from '../unit/unit.module';
import { KelasModule } from '../kelas/kelas.module';
import { BedService } from './services/bed.service';
import { BedController } from './controller/bed.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Bed, Unit, Kelas, Pendaftaran]),
    UnitModule,
    KelasModule,
  ],
  controllers: [BedController],
  providers: [BedService],
  exports: [BedService, TypeOrmModule],
})
export class BedModule {}
