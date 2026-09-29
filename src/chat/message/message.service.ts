import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In, Not } from 'typeorm';
import { Message } from '../entities/message.entity';
import { MessageReaction } from '../entities/message-reaction.entity';
import { MessageReadReceipt } from '../entities/message-read-receipt.entity';
import { Conversation } from '../entities/conversation.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { ConversationService } from '../conversation/conversation.service';
import { SendMessageDto } from './dto/send-message.dto';
import { UpdateMessageDto } from './dto/update-message.dto';
import { MessageType } from '../enums/chat.enum';

@Injectable()
export class MessageService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(MessageReaction)
    private readonly reactionRepo: Repository<MessageReaction>,
    @InjectRepository(MessageReadReceipt)
    private readonly receiptRepo: Repository<MessageReadReceipt>,
    @InjectRepository(Conversation)
    private readonly convRepo: Repository<Conversation>,
    private readonly tenantService: TenantContextService,
    private readonly conversationService: ConversationService,
    private readonly dataSource: DataSource,
  ) {}

  private get tenantId(): string {
    return this.tenantService.getTenantId();
  }

  private get currentUserId(): number {
    return Number(this.tenantService.getUserId());
  }

  /**
   * Ambil histori pesan dalam sebuah percakapan menggunakan cursor-based pagination.
   * Lebih efisien daripada offset pagination untuk data besar karena menggunakan
   * indeks pada created_at daripada OFFSET.
   *
   * @param conversationId - ID percakapan
   * @param limit - jumlah pesan per halaman (default 50)
   * @param before - cursor UUID pesan: ambil pesan sebelum pesan ini (scroll ke atas)
   */
  async findMessages(
    conversationId: string,
    limit = 50,
    before?: string,
  ): Promise<{ data: Message[]; nextCursor: string | null }> {
    await this.conversationService.assertParticipant(conversationId);

    const qb = this.messageRepo
      .createQueryBuilder('msg')
      .leftJoinAndSelect('msg.sender', 'sender')
      .leftJoinAndSelect('sender.pegawai', 'pegawai')
      .leftJoinAndSelect('msg.reactions', 'reactions')
      .leftJoinAndSelect('reactions.user', 'reactionUser')
      .leftJoinAndSelect('reactionUser.pegawai', 'reactionPegawai')
      .where('msg.conversationId = :conversationId', { conversationId })
      .andWhere('msg.tenantId = :tenantId', { tenantId: this.tenantId })
      .andWhere('msg.parentMessageId IS NULL') // hanya pesan root, bukan thread reply
      .orderBy('msg.createdAt', 'DESC')
      .take(limit + 1); // ambil satu lebih untuk deteksi apakah ada halaman berikutnya

    // Jika ada cursor: ambil pesan sebelum cursor tersebut
    if (before) {
      const cursorMsg = await this.messageRepo.findOne({ where: { id: before } });
      if (cursorMsg) {
        qb.andWhere('msg.createdAt < :cursorDate', { cursorDate: cursorMsg.createdAt });
      }
    }

    const messages = await qb.getMany();
    const hasMore = messages.length > limit;
    if (hasMore) messages.pop(); // buang elemen ekstra

    const rootIds = messages.map((m) => m.id);

    if (rootIds.length > 0) {
      const userId = this.currentUserId;

      // 1. Hitung total balasan (replyCount) per pesan induk
      const replyCounts = await this.messageRepo
        .createQueryBuilder('m')
        .select('m.parentMessageId', 'parentId')
        .addSelect('COUNT(*)', 'count')
        .where('m.parentMessageId IN (:...rootIds)', { rootIds })
        .andWhere('m.isDeleted = false')
        .groupBy('m.parentMessageId')
        .getRawMany();

      // 2. Hitung jumlah balasan dari orang lain yang belum dibaca user ini
      const unreadCounts = await this.messageRepo
        .createQueryBuilder('m')
        .select('m.parentMessageId', 'parentId')
        .addSelect('COUNT(*)', 'count')
        .leftJoin(
          MessageReadReceipt,
          'rr',
          'rr.message_id = m.id AND rr.user_id = :userId',
          { userId },
        )
        .where('m.parentMessageId IN (:...rootIds)', { rootIds })
        .andWhere('m.senderId != :userId', { userId })
        .andWhere('m.isDeleted = false')
        .andWhere('rr.id IS NULL')
        .groupBy('m.parentMessageId')
        .getRawMany();

      const replyMap = new Map(
        replyCounts.map((r) => [
          r.parentId || (r as any).parentid || (r as any).parent_message_id,
          Number(r.count),
        ]),
      );
      const unreadMap = new Map(
        unreadCounts.map((r) => [
          r.parentId || (r as any).parentid || (r as any).parent_message_id,
          Number(r.count),
        ]),
      );

      for (const msg of messages) {
        const rCount = replyMap.get(msg.id) ?? 0;
        const uCount = unreadMap.get(msg.id) ?? 0;
        (msg as any).replyCount = rCount;
        (msg as any).unreadThreadCount = uCount;
        (msg as any).hasUnreadThread = uCount > 0;
      }
    }

    return {
      data: messages.reverse(), // kembalikan urutan ascending untuk tampilan
      nextCursor: hasMore ? messages[0]?.id ?? null : null,
    };
  }

  /**
   * Ambil thread replies dari sebuah pesan.
   * Juga mengembalikan `unreadThreadCount` — jumlah balasan dari orang lain
   * yang belum ada di `message_read_receipts` untuk user yang sedang login.
   * Ini digunakan frontend untuk menampilkan badge "X pesan belum dibaca"
   * yang persisten antar session/device (tidak bergantung localStorage).
   */
  async findThreads(
    conversationId: string,
    parentMessageId: string,
  ): Promise<{ replies: Message[]; unreadThreadCount: number }> {
    await this.conversationService.assertParticipant(conversationId);
    const userId = this.currentUserId;

    const replies = await this.messageRepo
      .createQueryBuilder('msg')
      .leftJoinAndSelect('msg.sender', 'sender')
      .leftJoinAndSelect('sender.pegawai', 'pegawai')
      .leftJoinAndSelect('msg.reactions', 'reactions')
      .where('msg.conversationId = :conversationId', { conversationId })
      .andWhere('msg.parentMessageId = :parentMessageId', { parentMessageId })
      .andWhere('msg.tenantId = :tenantId', { tenantId: this.tenantId })
      .orderBy('msg.createdAt', 'ASC')
      .getMany();

    // Hitung balasan dari orang lain yang belum dibaca user ini
    // (belum ada record di chat_message_read_receipts)
    const replyIds = replies
      .filter((r) => r.senderId !== userId) // abaikan pesan sendiri
      .map((r) => r.id);

    let unreadThreadCount = 0;
    if (replyIds.length > 0) {
      // Ambil ID pesan yang sudah dibaca menggunakan TypeORM Repository (type-safe)
      const readReceipts = await this.receiptRepo.find({
        where: {
          messageId: In(replyIds),
          userId: userId,
        },
        select: ['messageId'],
      });

      const readIds = new Set(readReceipts.map((r) => r.messageId));
      unreadThreadCount = replyIds.filter((id) => !readIds.has(id)).length;
    }

    return { replies, unreadThreadCount };
  }

  /**
   * Kirim pesan baru ke percakapan.
   * Setelah pesan tersimpan, update lastMessageId dan lastActivityAt pada percakapan
   * dalam satu transaction untuk konsistensi data inbox.
   */
  async send(conversationId: string, dto: SendMessageDto): Promise<Message> {
    await this.conversationService.assertParticipant(conversationId);

    // Validasi parent message jika ada (reply/thread)
    if (dto.parentMessageId) {
      const parent = await this.messageRepo.findOne({
        where: { id: dto.parentMessageId, conversationId },
      });
      if (!parent) throw new NotFoundException('Pesan yang direply tidak ditemukan');
    }

    return this.dataSource.transaction(async (manager) => {
      const message = manager.create(Message, {
        tenantId: this.tenantId,
        conversationId,
        senderId: this.currentUserId,
        content: dto.content ?? null,
        type: dto.type ?? MessageType.TEXT,
        parentMessageId: dto.parentMessageId ?? null,
        attachmentUrl: dto.attachmentUrl ?? null,
        attachmentName: dto.attachmentName ?? null,
      });
      const saved = await manager.save(Message, message);

      // Update denormalisasi last message di percakapan
      // HANYA update lastMessageId jika pesan ini adalah root message (parentMessageId IS NULL)
      const updatePayload: Record<string, any> = {
        lastActivityAt: saved.createdAt,
      };
      if (!saved.parentMessageId) {
        updatePayload.lastMessageId = saved.id;
      }
      await manager.update(Conversation, conversationId, updatePayload);

      const fullMessage = await manager.findOne(Message, {
        where: { id: saved.id },
        relations: ['sender', 'sender.pegawai'],
      });

      return fullMessage || saved;
    });
  }

  /**
   * Edit konten pesan.
   * Hanya pengirim asli yang bisa mengedit.
   * Tidak bisa mengedit pesan yang sudah dihapus.
   */
  async update(
    conversationId: string,
    messageId: string,
    dto: UpdateMessageDto,
  ): Promise<Message> {
    const message = await this.findAndValidateOwnership(conversationId, messageId);

    if (message.isDeleted) {
      throw new BadRequestException('Tidak dapat mengedit pesan yang sudah dihapus');
    }

    if (dto.content !== undefined) {
      message.content = dto.content;
    }
    if (dto.attachmentName !== undefined) {
      message.attachmentName = dto.attachmentName;
    }
    if (dto.attachmentUrl !== undefined) {
      message.attachmentUrl = dto.attachmentUrl;
    }
    if (dto.type !== undefined) {
      message.type = dto.type;
    }

    message.isEdited = true;
    message.editedAt = new Date();
    return this.messageRepo.save(message);
  }

  /**
   * Hapus pesan (soft-delete dengan flag isDeleted).
   * Konten pesan dihapus tetapi rekaman tetap ada untuk konteks thread.
   */
  async remove(conversationId: string, messageId: string): Promise<void> {
    const message = await this.findAndValidateOwnership(conversationId, messageId);
    message.isDeleted = true;
    message.content = null;
    message.attachmentUrl = null;
    message.attachmentName = null;
    await this.messageRepo.save(message);
  }

  /**
   * Tambah atau hapus reaksi emoji pada pesan.
   * Toggle: jika reaksi yang sama sudah ada → hapus. Jika belum → tambah.
   */
  async toggleReaction(
    conversationId: string,
    messageId: string,
    emoji: string,
  ): Promise<{ action: 'added' | 'removed'; reaction?: MessageReaction }> {
    await this.conversationService.assertParticipant(conversationId);
    const userId = this.currentUserId;

    const existing = await this.reactionRepo.findOne({
      where: { messageId, userId, emoji },
    });

    if (existing) {
      await this.reactionRepo.remove(existing);
      return { action: 'removed' };
    }

    const reaction = this.reactionRepo.create({ messageId, userId, emoji });
    const saved = await this.reactionRepo.save(reaction);
    return { action: 'added', reaction: saved };
  }

  /**
   * Tandai sebuah pesan sudah dibaca oleh user saat ini.
   * Menggunakan INSERT ... ON CONFLICT DO NOTHING untuk idempotent.
   */
  async markRead(conversationId: string, messageId: string): Promise<void> {
    await this.conversationService.assertParticipant(conversationId);
    const userId = this.currentUserId;

    await this.dataSource
      .createQueryBuilder()
      .insert()
      .into(MessageReadReceipt)
      .values({ messageId, userId })
      .orIgnore() // ON CONFLICT DO NOTHING — idempotent
      .execute();
  }

  /**
   * Tandai SEMUA balasan thread dari sebuah pesan induk sebagai terbaca.
   *
   * Logic:
   * 1. Ambil semua message ID dari thread (parentMessageId = messageId)
   * 2. Filter: hanya pesan dari orang lain (bukan milik user sendiri)
   * 3. Batch INSERT ke chat_message_read_receipts dengan ON CONFLICT DO NOTHING
   *
   * Dipanggil saat user membuka Thread Panel — satu request menggantikan N request.
   * Idempotent: aman dipanggil berkali-kali.
   */
  async markThreadRead(conversationId: string, parentMessageId: string): Promise<void> {
    await this.conversationService.assertParticipant(conversationId);
    const userId = this.currentUserId;

    // Ambil semua reply ID dari thread yang dikirim orang lain
    const replyMessages = await this.messageRepo.find({
      where: {
        conversationId,
        parentMessageId,
        senderId: Not(userId),
      },
      select: ['id'],
    });

    if (replyMessages.length === 0) return;

    // Ambil ID yang sudah ada di database untuk mencegah duplikasi
    const existingReceipts = await this.receiptRepo.find({
      where: {
        messageId: In(replyMessages.map((m) => m.id)),
        userId,
      },
      select: ['messageId'],
    });

    const existingIds = new Set(existingReceipts.map((r) => r.messageId));
    const newReceipts = replyMessages
      .filter((m) => !existingIds.has(m.id))
      .map((m) => this.receiptRepo.create({ messageId: m.id, userId }));

    if (newReceipts.length > 0) {
      await this.receiptRepo.save(newReceipts);
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────────

  private async findAndValidateOwnership(
    conversationId: string,
    messageId: string,
  ): Promise<Message> {
    await this.conversationService.assertParticipant(conversationId);

    const message = await this.messageRepo.findOne({
      where: { id: messageId, conversationId, tenantId: this.tenantId },
    });
    if (!message) throw new NotFoundException('Pesan tidak ditemukan');
    if (message.senderId !== this.currentUserId) {
      throw new ForbiddenException('Anda hanya bisa mengubah pesan Anda sendiri');
    }
    return message;
  }
}
