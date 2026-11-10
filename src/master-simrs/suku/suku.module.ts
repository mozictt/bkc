import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Suku } from '@entities/suku.entity';
import { SukuService } from './services/suku.service';
import { SukuController } from './controller/suku.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Suku])],
  controllers: [SukuController],
  providers: [SukuService],
})
export class SukuModule {}

