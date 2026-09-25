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
import { ConversationType } from '../enums/chat.enum';

/**
 * Entitas percakapan — menjadi wadah untuk pesan direct (1-on-1) maupun group chat.
 *
 * PENTING: Entity ini tidak mengimport entity chat lain (ConversationParticipant, Message)
 * untuk menghindari circular dependency. Semua relasi ke entity lain menggunakan
 * string reference TypeORM (nama string entity), sehingga TypeORM me-resolve
 * saat runtime ketika semua entity sudah teregistrasi di DataSource.
 */
@Entity('chat_conversations')
export class Conversation extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Tipe percakapan: 'direct' (1-on-1) atau 'group' */
  @Index()
  @Column({
    type: 'enum',
    enum: ConversationType,
    default: ConversationType.DIRECT,
  })
  type: ConversationType;

  /** Nama grup (hanya untuk type='group') */
  @Column({ type: 'varchar', length: 150, nullable: true })
  name: string | null;

  /** Path avatar grup */
  @Column({ type: 'varchar', nullable: true })
  avatar: string | null;

  @Column({ name: 'created_by', type: 'int' })
  createdBy: number;

  /** User yang membuat percakapan/grup */
  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  /**
   * ID pesan terakhir — denormalisasi untuk efisiensi query inbox.
   * String reference 'Message' untuk menghindari circular import.
   */
  @Column({ name: 'last_message_id', type: 'uuid', nullable: true })
  lastMessageId: string | null;

  @ManyToOne('Message', { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'last_message_id' })
  lastMessage: any | null;

  /** Timestamp aktivitas terakhir — digunakan untuk sorting inbox */
  @Index()
  @Column({ name: 'last_activity_at', type: 'timestamptz', nullable: true })
  lastActivityAt: Date | null;

  /**
   * String reference 'ConversationParticipant' untuk menghindari circular import.
   * Dependency graph: ConversationParticipant → Conversation (satu arah, aman).
   */
  @OneToMany('ConversationParticipant', 'conversation')
  participants: any[];

  /**
   * Relasi ke seluruh pesan.
   * Menggunakan string reference 'Message' untuk menghindari circular import.
   */
  @OneToMany('Message', 'conversation')
  messages: any[];
}
