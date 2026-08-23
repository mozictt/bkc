import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WhatsappService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappDevice } from './entities/whatsapp-device.entity';
import { WhatsappLog } from './entities/whatsapp-log.entity';
import { WhatsappContact } from './entities/whatsapp-contact.entity';
import { Tenant } from '../entities/tenant.entity';
import { WhatsappGateway } from './whatsapp.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([WhatsappDevice, WhatsappLog, WhatsappContact, Tenant])],
  providers: [WhatsappService, WhatsappGateway],
  controllers: [WhatsappController],
  exports: [WhatsappService],
})
export class WhatsappModule {}
