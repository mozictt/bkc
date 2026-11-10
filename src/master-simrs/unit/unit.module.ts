import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Unit } from '@entities/unit.entity';
import { Kelas } from '@entities/kelas.entity';
import { KelasModule } from '../kelas/kelas.module';
import { UnitService } from './services/unit.service';
import { UnitController } from './controller/unit.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Unit, Kelas]), KelasModule],
  controllers: [UnitController],
  providers: [UnitService],
  exports: [UnitService, TypeOrmModule],
})
export class UnitModule {}

