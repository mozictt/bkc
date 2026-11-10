import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Kelas } from '@entities/kelas.entity';
import { KelasService } from './services/kelas.service';
import { KelasController } from './controller/kelas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Kelas])],
  controllers: [KelasController],
  providers: [KelasService],
  exports: [KelasService, TypeOrmModule],
})
export class KelasModule {}

