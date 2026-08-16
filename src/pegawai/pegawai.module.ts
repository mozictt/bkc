import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pegawai } from '../entities/pegawai.entity';
import { User } from '../entities/user.entity';
import { PegawaiService } from './pegawai.service';
import { PegawaiController } from './pegawai.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Pegawai, User])],
  controllers: [PegawaiController],
  providers: [PegawaiService],
  exports: [PegawaiService, TypeOrmModule],
})
export class PegawaiModule {}
