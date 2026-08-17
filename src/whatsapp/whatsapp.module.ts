import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappDevice } from './entities/whatsapp-device.entity';
import { WhatsappLog } from './entities/whatsapp-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WhatsappDevice, WhatsappLog])],
  providers: [WhatsappService],
  controllers: [WhatsappController],
  exports: [WhatsappService],
})
export class WhatsappModule {}
