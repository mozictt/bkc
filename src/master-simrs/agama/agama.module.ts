import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agama } from '@entities/agama.entity';
import { AgamaService } from './services/agama.service';
import { AgamaController } from './controller/agama.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Agama])],
  controllers: [AgamaController],
  providers: [AgamaService],
})
export class AgamaModule {}

