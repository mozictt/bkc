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
// Import Message dihindari (circular dependency) — TypeORM resolve via lazy arrow function
import type { Message } from './message.entity';

/**
 * Entitas reaksi pesan (emoji reaction).
 * Unique constraint memastikan satu user hanya bisa memberikan
 * satu reaksi dengan emoji yang sama pada satu pesan.
 * Jika ingin ganti emoji, harus hapus reaksi lama lalu tambah baru.
 */
@Entity('chat_message_reactions')
@Unique(['messageId', 'userId', 'emoji'])
export class MessageReaction {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'message_id', type: 'uuid' })
  messageId: string;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  @ManyToOne(() => require('./message.entity').Message, (m: any) => m.reactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: Message;

  @Index()
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** Karakter emoji unicode, contoh: '👍', '❤️', '😂' */
  @Column({ type: 'varchar', length: 10 })
  emoji: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
