import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Conversation } from '../entities/conversation.entity';
import { ConversationParticipant } from '../entities/conversation-participant.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { UpdateConversationDto } from './dto/update-conversation.dto';
import { ConversationType, ParticipantRole } from '../enums/chat.enum';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation)
    private readonly convRepo: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly participantRepo: Repository<ConversationParticipant>,
    private readonly tenantService: TenantContextService,
    private readonly dataSource: DataSource,
  ) {}

  private get tenantId(): string {
    const id = this.tenantService.getTenantId();
    if (!id) throw new Error('Tenant context tidak ditemukan');
    return id;
  }

  private get currentUserId(): number {
    return Number(this.tenantService.getUserId());
  }

  /**
   * Ambil semua percakapan (inbox) milik user yang sedang login.
   * Diurutkan berdasarkan last_activity_at DESC (pesan terbaru di atas).
   * Satu query dengan JOIN — menghindari N+1.
   */
  async findAllByUser(): Promise<any[]> {
    const userId = this.currentUserId;

    const conversations = await this.convRepo
      .createQueryBuilder('conv')
      .innerJoin(
        'conv.participants',
        'me',
        'me.userId = :userId AND me.leftAt IS NULL',
        { userId },
      )
      .leftJoinAndSelect('conv.lastMessage', 'lastMsg')
      .leftJoinAndSelect('lastMsg.sender', 'lastSender')
      .leftJoinAndSelect('lastSender.pegawai', 'lastSenderPegawai')
      .leftJoinAndSelect('conv.participants', 'participants')
      .leftJoinAndSelect('participants.user', 'partUser')
      .leftJoinAndSelect('partUser.pegawai', 'partPegawai')
      .where('conv.tenantId = :tenantId', { tenantId: this.tenantId })
      .andWhere('conv.deletedAt IS NULL')
      .andWhere('participants.leftAt IS NULL')
      .orderBy('conv.lastActivityAt', 'DESC')
      .getMany();

    // Hitung unread count per percakapan
    return Promise.all(
      conversations.map(async (conv) => {
        const meParticipant = conv.participants.find((p) => p.userId === userId);
        const unreadCount = await this.countUnread(conv.id, userId, meParticipant?.lastReadAt);
        return { ...conv, unreadCount };
      }),
    );
  }

  /**
   * Hitung pesan yang belum terbaca sejak lastReadAt.
   */
  private async countUnread(
    conversationId: string,
    userId: number,
    lastReadAt: Date | null,
  ): Promise<number> {
    const qb = this.dataSource
      .createQueryBuilder()
      .select('COUNT(*)', 'count')
      .from('chat_messages', 'm')
      .where('m.conversation_id = :conversationId', { conversationId })
      .andWhere('m.sender_id != :userId', { userId })
      .andWhere('m.is_deleted = false')
      .andWhere('m.deleted_at IS NULL');

    if (lastReadAt) {
      qb.andWhere('m.created_at > :lastReadAt', { lastReadAt });
    }

    const result = await qb.getRawOne();
    return Number(result?.count ?? 0);
  }

  /**
   * Ambil detail percakapan & peserta tanpa validasi user context request (khusus gateway/broadcast).
   */
  async findOneRaw(id: string): Promise<Conversation | null> {
    return this.convRepo
      .createQueryBuilder('conv')
      .leftJoinAndSelect('conv.participants', 'participants')
      .leftJoinAndSelect('participants.user', 'partUser')
      .leftJoinAndSelect('partUser.pegawai', 'partPegawai')
      .leftJoinAndSelect('conv.lastMessage', 'lastMsg')
      .where('conv.id = :id', { id })
      .andWhere('conv.deletedAt IS NULL')
      .getOne();
  }

  /**
   * Ambil detail satu percakapan beserta daftar peserta.
   * Validasi bahwa user adalah peserta aktif percakapan tersebut.
   */
  async findOne(id: string): Promise<Conversation> {
    await this.assertParticipant(id);

    const conv = await this.convRepo
      .createQueryBuilder('conv')
      .leftJoinAndSelect('conv.participants', 'participants')
      .leftJoinAndSelect('participants.user', 'partUser')
      .leftJoinAndSelect('partUser.pegawai', 'partPegawai')
      .leftJoinAndSelect('conv.lastMessage', 'lastMsg')
      .where('conv.id = :id', { id })
      .andWhere('conv.tenantId = :tenantId', { tenantId: this.tenantId })
      .andWhere('conv.deletedAt IS NULL')
      .getOne();

    if (!conv) throw new NotFoundException('Percakapan tidak ditemukan');
    return conv;
  }

  /**
   * Buat percakapan baru (direct atau group).
   * Untuk direct: cek apakah sudah ada percakapan aktif antar dua user tersebut.
   * Menggunakan database transaction untuk menjamin atomicity.
   */
  async create(dto: CreateConversationDto): Promise<Conversation> {
    const userId = this.currentUserId;
    const tenantId = this.tenantId;

    // Validasi jumlah peserta
    if (dto.type === ConversationType.DIRECT && dto.participantIds.length !== 1) {
      throw new BadRequestException('Percakapan direct harus memiliki tepat 1 peserta tujuan');
    }
    if (dto.type === ConversationType.GROUP && dto.participantIds.length < 2) {
      throw new BadRequestException('Percakapan group minimal memiliki 2 peserta');
    }

    // Cek percakapan direct yang sudah ada
    if (dto.type === ConversationType.DIRECT) {
      const existing = await this.findExistingDirect(userId, dto.participantIds[0]);
      if (existing) return existing;
    }

    return this.dataSource.transaction(async (manager) => {
      const conv = manager.create(Conversation, {
        tenantId,
        type: dto.type,
        name: dto.name ?? null,
        createdBy: userId,
        lastActivityAt: new Date(),
      });
      const saved = await manager.save(Conversation, conv);

      // Tambah creator sebagai admin
      const allParticipantIds = [userId, ...dto.participantIds.filter((id) => id !== userId)];
      const participants = allParticipantIds.map((pid) =>
        manager.create(ConversationParticipant, {
          conversationId: saved.id,
          userId: pid,
          role: pid === userId ? ParticipantRole.ADMIN : ParticipantRole.MEMBER,
          joinedAt: new Date(),
        }),
      );
      await manager.save(ConversationParticipant, participants);

      return saved;
    });
  }

  /**
   * Cari percakapan direct yang sudah ada antara dua user.
   * Query subquery untuk menemukan conversation yang memiliki TEPAT kedua user.
   */
  private async findExistingDirect(
    userId: number,
    otherId: number,
  ): Promise<Conversation | null> {
    return this.convRepo
      .createQueryBuilder('conv')
      .innerJoin(
        'conv.participants',
        'p1',
        'p1.userId = :userId AND p1.leftAt IS NULL',
        { userId },
      )
      .innerJoin(
        'conv.participants',
        'p2',
        'p2.userId = :otherId AND p2.leftAt IS NULL',
        { otherId },
      )
      .where('conv.type = :type', { type: ConversationType.DIRECT })
      .andWhere('conv.tenantId = :tenantId', { tenantId: this.tenantId })
      .andWhere('conv.deletedAt IS NULL')
      .getOne();
  }

  /**
   * Update nama atau avatar grup.
   * Hanya admin grup yang diizinkan.
   */
  async update(id: string, dto: UpdateConversationDto): Promise<Conversation> {
    await this.assertAdmin(id);
    const conv = await this.convRepo.findOne({ where: { id, tenantId: this.tenantId } });
    if (!conv) throw new NotFoundException('Percakapan tidak ditemukan');

    if (dto.name !== undefined) conv.name = dto.name;
    if (dto.avatar !== undefined) conv.avatar = dto.avatar;

    return this.convRepo.save(conv);
  }

  /**
   * Tambah anggota ke grup (hanya admin).
   */
  async addParticipant(conversationId: string, userId: number): Promise<ConversationParticipant> {
    await this.assertAdmin(conversationId);

    const existing = await this.participantRepo.findOne({
      where: { conversationId, userId },
      withDeleted: false,
    });
    if (existing && !existing.leftAt) {
      throw new BadRequestException('User sudah menjadi anggota grup ini');
    }

    // Restore jika pernah keluar
    if (existing?.leftAt) {
      existing.leftAt = null;
      existing.joinedAt = new Date();
      return this.participantRepo.save(existing);
    }

    const participant = this.participantRepo.create({
      conversationId,
      userId,
      role: ParticipantRole.MEMBER,
      joinedAt: new Date(),
    });
    return this.participantRepo.save(participant);
  }

  /**
   * Keluarkan anggota dari grup (hanya admin, atau user keluar sendiri).
   */
  async removeParticipant(conversationId: string, targetUserId: number): Promise<void> {
    const userId = this.currentUserId;
    const participant = await this.participantRepo.findOne({
      where: { conversationId, userId: targetUserId },
    });
    if (!participant || participant.leftAt) {
      throw new NotFoundException('Peserta tidak ditemukan');
    }

    // Admin bisa keluarkan siapapun, member hanya bisa keluar sendiri
    if (userId !== targetUserId) {
      await this.assertAdmin(conversationId);
    }

    participant.leftAt = new Date();
    await this.participantRepo.save(participant);
  }

  /**
   * Tandai semua pesan dalam percakapan sebagai terbaca.
   */
  async markAllRead(conversationId: string): Promise<void> {
    const userId = this.currentUserId;
    await this.assertParticipant(conversationId);

    // 1. Update lastReadAt participant
    await this.participantRepo.update(
      { conversationId, userId },
      { lastReadAt: new Date() },
    );

    // 2. Tandai semua balasan thread di percakapan ini sebagai terbaca
    const replyMessages = await this.dataSource
      .createQueryBuilder()
      .select('m.id', 'id')
      .from('chat_messages', 'm')
      .where('m.conversation_id = :conversationId', { conversationId })
      .andWhere('m.parent_message_id IS NOT NULL')
      .andWhere('m.sender_id != :userId', { userId })
      .getRawMany<{ id: string }>();

    if (replyMessages.length > 0) {
      const replyIds = replyMessages.map((m) => m.id);

      const existingReceipts = await this.dataSource
        .createQueryBuilder()
        .select('rr.message_id', 'messageId')
        .from('chat_message_read_receipts', 'rr')
        .where('rr.message_id IN (:...replyIds)', { replyIds })
        .andWhere('rr.user_id = :userId', { userId })
        .getRawMany<{ messageId: string }>();

      const existingIds = new Set(existingReceipts.map((r) => r.messageId || (r as any).messageid));
      const newValues = replyIds
        .filter((id) => !existingIds.has(id))
        .map((id) => ({ message_id: id, user_id: userId }));

      if (newValues.length > 0) {
        await this.dataSource
          .createQueryBuilder()
          .insert()
          .into('chat_message_read_receipts')
          .values(newValues)
          .execute();
      }
    }
  }

  // ─── Guard Helpers ───────────────────────────────────────────────────────────

  async assertParticipant(conversationId: string): Promise<ConversationParticipant> {
    const userId = this.currentUserId;
    const participant = await this.participantRepo.findOne({
      where: { conversationId, userId },
    });
    if (!participant || participant.leftAt) {
      throw new ForbiddenException('Anda bukan peserta percakapan ini');
    }
    return participant;
  }

  async assertAdmin(conversationId: string): Promise<void> {
    const participant = await this.assertParticipant(conversationId);
    if (participant.role !== ParticipantRole.ADMIN) {
      throw new ForbiddenException('Hanya admin grup yang dapat melakukan aksi ini');
    }
  }
}
