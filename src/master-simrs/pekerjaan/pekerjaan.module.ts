import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pekerjaan } from '@entities/pekerjaan.entity';
import { PekerjaanService } from './services/pekerjaan.service';
import { PekerjaanController } from './controller/pekerjaan.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Pekerjaan])],
  controllers: [PekerjaanController],
  providers: [PekerjaanService],
})
export class PekerjaanModule {}

