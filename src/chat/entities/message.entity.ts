import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantBaseEntity } from '@entities/tenant-base.entity';
import { User } from '@entities/user.entity';
import { MessageType } from '../enums/chat.enum';
import { Conversation } from './conversation.entity';
import { MessageReaction } from './message-reaction.entity';
import { MessageReadReceipt } from './message-read-receipt.entity';

/**
 * Entitas pesan — menyimpan semua pesan dalam sebuah percakapan.
 *
 * Self-reference pada `parentMessageId` memungkinkan fitur threading/reply:
 * - Jika `parentMessageId` NULL → pesan utama di dalam percakapan
 * - Jika `parentMessageId` berisi UUID → pesan ini adalah reply dari pesan tersebut
 *
 * Menggunakan UUID sebagai PK untuk keamanan dan konsistensi dengan Conversation.
 */
@Entity('chat_messages')
export class Message extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @ManyToOne(() => Conversation, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Index()
  @Column({ name: 'sender_id', type: 'int' })
  senderId: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sender_id' })
  sender: User;

  /**
   * Self-reference untuk thread/reply.
   * NULL = pesan root; berisi UUID = reply dari pesan parent.
   */
  @Index()
  @Column({ name: 'parent_message_id', type: 'uuid', nullable: true })
  parentMessageId: string | null;

  @ManyToOne(() => Message, (m) => m.replies, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_message_id' })
  parentMessage: Message | null;

  /** Relasi satu pesan ke banyak reply (thread) */
  @OneToMany(() => Message, (m) => m.parentMessage)
  replies: Message[];

  /** Konten teks pesan */
  @Column({ type: 'text', nullable: true })
  content: string | null;

  /** Tipe pesan: text, image, file, audio, atau system (notifikasi otomatis) */
  @Column({
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type: MessageType;

  /** URL file attachment (gambar/dokumen/audio) */
  @Column({ name: 'attachment_url', type: 'varchar', nullable: true })
  attachmentUrl: string | null;

  /** Nama asli file attachment */
  @Column({ name: 'attachment_name', type: 'varchar', nullable: true })
  attachmentName: string | null;

  /** Flag apakah pesan sudah diedit */
  @Column({ name: 'is_edited', type: 'boolean', default: false })
  isEdited: boolean;

  @Column({ name: 'edited_at', type: 'timestamptz', nullable: true })
  editedAt: Date | null;

  /**
   * Soft-delete pesan: konten disembunyikan tapi rekam jejak tetap ada.
   * Menggunakan flag terpisah dari `deletedAt` TenantBaseEntity
   * karena penghapusan pesan hanya oleh pengirim, bukan tenant-level delete.
   */
  @Column({ name: 'is_deleted', type: 'boolean', default: false })
  isDeleted: boolean;

  /** Relasi reaksi emoji pada pesan ini */
  @OneToMany(() => MessageReaction, (r) => r.message)
  reactions: MessageReaction[];

  /** Relasi tanda baca pada pesan ini */
  @OneToMany(() => MessageReadReceipt, (r) => r.message)
  readReceipts: MessageReadReceipt[];
}
