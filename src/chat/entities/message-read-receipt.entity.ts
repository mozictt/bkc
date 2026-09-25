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
 * Entitas tanda baca pesan (read receipt).
 * Unique constraint memastikan satu user hanya memiliki satu catatan
 * waktu baca untuk setiap pesan (upsert-friendly).
 */
@Entity('chat_message_read_receipts')
@Unique(['messageId', 'userId'])
export class MessageReadReceipt {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'message_id', type: 'uuid' })
  messageId: string;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  @ManyToOne(() => require('./message.entity').Message, (m: any) => m.readReceipts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message: Message;

  @Index()
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** Waktu pertama kali user membaca pesan ini */
  @CreateDateColumn({ name: 'read_at', type: 'timestamptz' })
  readAt: Date;
}
