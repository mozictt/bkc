import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TarifTindakan } from '@entities/tarif-tindakan.entity';
import { TarifLayanan } from '@entities/tarif-layanan.entity';
import { Unit } from '@entities/unit.entity';
import { Penjamin } from '@entities/penjamin.entity';
import { Kelas } from '@entities/kelas.entity';
import { UnitModule } from '../unit/unit.module';
import { PenjaminModule } from '../penjamin/penjamin.module';
import { KelasModule } from '../kelas/kelas.module';
import { TarifService } from './services/tarif.service';
import { TarifController } from './controller/tarif.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([TarifTindakan, TarifLayanan, Unit, Penjamin, Kelas]),
    UnitModule,
    PenjaminModule,
    KelasModule,
  ],
  controllers: [TarifController],
  providers: [TarifService],
  exports: [TarifService, TypeOrmModule],
})
export class TarifModule {}
