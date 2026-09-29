import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
  DefaultValuePipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { MessageService } from './message.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';

import { Inject, forwardRef } from '@nestjs/common';
import { ChatGateway } from '../gateway/chat.gateway';

@ApiTags('Chat - Pesan')
@ApiBearerAuth()
@Controller('chat/conversations/:conversationId/messages')
export class MessageController {
  constructor(
    private readonly messageService: MessageService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Ambil histori pesan dalam percakapan (cursor-based pagination)' })
  @ApiParam({ name: 'conversationId', description: 'UUID percakapan' })
  @ApiQuery({ name: 'limit', description: 'Jumlah pesan per halaman', required: false, type: Number })
  @ApiQuery({ name: 'before', description: 'Cursor: UUID pesan untuk pagination scroll ke atas', required: false })
  @ApiResponse({ status: 200, description: 'Histori pesan dengan cursor berikutnya' })
  findMessages(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Query('limit', new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query('before') before?: string,
  ) {
    return this.messageService.findMessages(conversationId, limit, before);
  }

  @Get(':messageId/threads')
  @ApiOperation({ summary: 'Ambil thread reply dari sebuah pesan' })
  @ApiParam({ name: 'conversationId', description: 'UUID percakapan' })
  @ApiParam({ name: 'messageId', description: 'UUID pesan induk (parent)' })
  findThreads(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.messageService.findThreads(conversationId, messageId);
  }

  @Post()
  @ApiOperation({ summary: 'Kirim pesan baru (atau reply dalam thread)' })
  @ApiParam({ name: 'conversationId', description: 'UUID percakapan' })
  @ApiResponse({ status: 201, description: 'Pesan berhasil dikirim' })
  async send(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() dto: SendMessageDto,
  ) {
    const savedMessage = await this.messageService.send(conversationId, dto);
    if (this.chatGateway) {
      const senderUserId = (savedMessage as any).senderId || (savedMessage as any).sender?.id;
      await this.chatGateway.broadcastNewMessage(conversationId, savedMessage, senderUserId);
    }
    return savedMessage;
  }

  @Patch(':messageId')
  @ApiOperation({ summary: 'Edit konten atau keterangan (caption) pesan (hanya pengirim)' })
  @ApiParam({ name: 'conversationId', description: 'UUID percakapan' })
  @ApiParam({ name: 'messageId', description: 'UUID pesan' })
  async update(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body() dto: UpdateMessageDto,
  ) {
    const updated = await this.messageService.update(conversationId, messageId, dto);
    if (this.chatGateway) {
      this.chatGateway.broadcastMessageUpdate(conversationId, updated);
    }
    return updated;
  }

  @Delete(':messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Hapus pesan (hanya pengirim)' })
  @ApiParam({ name: 'conversationId', description: 'UUID percakapan' })
  @ApiParam({ name: 'messageId', description: 'UUID pesan' })
  remove(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.messageService.remove(conversationId, messageId);
  }

  @Post(':messageId/reactions')
  @ApiOperation({ summary: 'Toggle reaksi emoji pada pesan' })
  @ApiParam({ name: 'conversationId', description: 'UUID percakapan' })
  @ApiParam({ name: 'messageId', description: 'UUID pesan' })
  @ApiQuery({ name: 'emoji', description: 'Karakter emoji, contoh: 👍', required: true })
  toggleReaction(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Query('emoji') emoji: string,
  ) {
    return this.messageService.toggleReaction(conversationId, messageId, emoji);
  }

  @Post(':messageId/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Tandai pesan sebagai terbaca' })
  @ApiParam({ name: 'conversationId', description: 'UUID percakapan' })
  @ApiParam({ name: 'messageId', description: 'UUID pesan' })
  markRead(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.messageService.markRead(conversationId, messageId);
  }

  @Post(':messageId/threads/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Tandai semua balasan thread sebagai terbaca (batch)',
    description:
      'Mencatat bahwa user sudah membaca semua balasan dari thread ini. ' +
      'Digunakan saat user membuka Thread Panel di group chat. ' +
      'Idempotent: aman dipanggil berkali-kali.',
  })
  @ApiParam({ name: 'conversationId', description: 'UUID percakapan' })
  @ApiParam({ name: 'messageId', description: 'UUID pesan induk (parent) thread' })
  markThreadRead(
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.messageService.markThreadRead(conversationId, messageId);
  }
}
