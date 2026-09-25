import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
  CreateDateColumn,
} from 'typeorm';
import { User } from '@entities/user.entity';
import { Conversation } from './conversation.entity';
import { ParticipantRole } from '../enums/chat.enum';

/**
 * Entitas peserta percakapan — menjembatani relasi many-to-many
 * antara User dan Conversation, dengan metadata tambahan seperti
 * role, status baca terakhir, dan mute.
 *
 * Unique constraint memastikan satu user hanya bisa menjadi peserta
 * satu kali dalam sebuah percakapan.
 */
@Entity('chat_conversation_participants')
@Unique(['conversationId', 'userId'])
export class ConversationParticipant {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'conversation_id', type: 'uuid' })
  conversationId: string;

  @ManyToOne(() => Conversation, (c) => c.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Index()
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** Role dalam percakapan: 'admin' bisa mengelola anggota, 'member' hanya bisa chat */
  @Column({
    type: 'enum',
    enum: ParticipantRole,
    default: ParticipantRole.MEMBER,
  })
  role: ParticipantRole;

  @CreateDateColumn({ name: 'joined_at', type: 'timestamptz' })
  joinedAt: Date;

  /** Timestamp terakhir user membaca pesan — digunakan untuk hitung unread count */
  @Column({ name: 'last_read_at', type: 'timestamptz', nullable: true })
  lastReadAt: Date | null;

  /** Apakah user mematikan notifikasi untuk percakapan ini */
  @Column({ name: 'is_muted', type: 'boolean', default: false })
  isMuted: boolean;

  /** Timestamp ketika user meninggalkan grup (soft-leave) */
  @Column({ name: 'left_at', type: 'timestamptz', nullable: true })
  leftAt: Date | null;
}
