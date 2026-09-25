import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ConversationService } from './conversation.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';

@ApiTags('Chat - Inbox & Grup')
@ApiBearerAuth()
@Controller('chat/conversations')
export class ConversationController {
  constructor(private readonly conversationService: ConversationService) {}

  @Get()
  @ApiOperation({ summary: 'Ambil semua inbox percakapan user (diurutkan terbaru)' })
  @ApiResponse({ status: 200, description: 'Daftar percakapan dengan unread count' })
  findAll() {
    return this.conversationService.findAllByUser();
  }

  @Post()
  @ApiOperation({ summary: 'Buat percakapan baru (direct atau group)' })
  @ApiResponse({ status: 201, description: 'Percakapan berhasil dibuat' })
  create(@Body() dto: CreateConversationDto) {
    return this.conversationService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detail percakapan beserta daftar peserta' })
  @ApiParam({ name: 'id', description: 'UUID percakapan' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversationService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update nama atau avatar grup (hanya admin)' })
  @ApiParam({ name: 'id', description: 'UUID percakapan' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.conversationService.update(id, dto);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Tandai semua pesan dalam percakapan sebagai terbaca' })
  @ApiParam({ name: 'id', description: 'UUID percakapan' })
  markAllRead(@Param('id', ParseUUIDPipe) id: string) {
    return this.conversationService.markAllRead(id);
  }

  // ─── Manajemen Peserta Grup ──────────────────────────────────────────────────

  @Get(':id/participants')
  @ApiOperation({ summary: 'Ambil daftar peserta percakapan/grup' })
  @ApiParam({ name: 'id', description: 'UUID percakapan' })
  async getParticipants(@Param('id', ParseUUIDPipe) id: string) {
    const conv = await this.conversationService.findOne(id);
    return conv.participants;
  }

  @Post(':id/participants/:userId')
  @ApiOperation({ summary: 'Tambah anggota ke grup (hanya admin)' })
  @ApiParam({ name: 'id', description: 'UUID percakapan' })
  @ApiParam({ name: 'userId', description: 'ID user yang akan ditambahkan' })
  addParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.conversationService.addParticipant(id, userId);
  }

  @Delete(':id/participants/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Keluarkan anggota dari grup, atau keluar sendiri' })
  @ApiParam({ name: 'id', description: 'UUID percakapan' })
  @ApiParam({ name: 'userId', description: 'ID user yang akan dikeluarkan' })
  removeParticipant(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('userId', ParseIntPipe) userId: number,
  ) {
    return this.conversationService.removeParticipant(id, userId);
  }
}
