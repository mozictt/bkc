import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ChatGateway } from './gateway/chat.gateway';
import { PresenceService } from './presence/presence.service';
import { ContactModule } from './contact/contact.module';
import { ConversationModule } from './conversation/conversation.module';
import { MessageModule } from './message/message.module';
import { CommonModule } from '../common/common.module';

/**
 * ChatModule — modul utama yang mengintegrasikan semua sub-modul chat:
 * kontak, percakapan, pesan, dan WebSocket gateway.
 *
 * JwtModule di-register secara async agar bisa membaca JWT_SECRET dari ConfigService.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    ContactModule,
    ConversationModule,
    forwardRef(() => MessageModule),
    CommonModule,
  ],
  providers: [ChatGateway, PresenceService],
  exports: [ChatGateway],
})
export class ChatModule {}
