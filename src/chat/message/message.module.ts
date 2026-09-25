import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { Message } from '../entities/message.entity';
import { MessageReaction } from '../entities/message-reaction.entity';
import { MessageReadReceipt } from '../entities/message-read-receipt.entity';
import { Conversation } from '../entities/conversation.entity';
import { ConversationModule } from '../conversation/conversation.module';
import { CommonModule } from '../../common/common.module';
import { ChatModule } from '../chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, MessageReaction, MessageReadReceipt, Conversation]),
    ConversationModule, // import agar ConversationService tersedia via DI
    CommonModule,
    forwardRef(() => ChatModule),
  ],
  controllers: [MessageController],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule {}
