import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pendidikan } from '@entities/pendidikan.entity';
import { PendidikanService } from './services/pendidikan.service';
import { PendidikanController } from './controller/pendidikan.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Pendidikan])],
  controllers: [PendidikanController],
  providers: [PendidikanService],
})
export class PendidikanModule {}

