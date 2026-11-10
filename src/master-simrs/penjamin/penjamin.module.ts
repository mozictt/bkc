import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Penjamin } from '@entities/penjamin.entity';
import { PenjaminService } from './services/penjamin.service';
import { PenjaminController } from './controller/penjamin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Penjamin])],
  controllers: [PenjaminController],
  providers: [PenjaminService],
  exports: [PenjaminService, TypeOrmModule],
})
export class PenjaminModule {}

