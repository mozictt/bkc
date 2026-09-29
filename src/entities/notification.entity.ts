import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

export enum NotificationType {
  CHAT_DIRECT = 'CHAT_DIRECT',
  CHAT_GROUP = 'CHAT_GROUP',
  CHAT_THREAD_REPLY = 'CHAT_THREAD_REPLY',
  CHAT_MENTION = 'CHAT_MENTION',
  WA_INCOMING = 'WA_INCOMING',
  WA_SESSION_DISCONNECT = 'WA_SESSION_DISCONNECT',
  DOC_SHARED = 'DOC_SHARED',
  DOC_EXPIRING = 'DOC_EXPIRING',
  SYS_ANNOUNCEMENT = 'SYS_ANNOUNCEMENT',
}

@Entity('notifications')
@Index(['userId', 'isRead'])
@Index(['userId', 'createdAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'tenant_id', type: 'varchar', length: 100, nullable: true })
  tenantId: string | null;

  @Column({ type: 'varchar', length: 50, default: NotificationType.CHAT_DIRECT })
  type: NotificationType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'action_url', type: 'varchar', length: 500, nullable: true })
  actionUrl: string | null;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, any> | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @Column({ name: 'read_at', type: 'timestamp', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
