import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../entities/user.entity';
import { Tenant } from '../../entities/tenant.entity';

@Entity('activity_logs')
@Index('idx_activity_logs_tenant_created', ['tenantId', 'createdAt'])
@Index('idx_activity_logs_user_created', ['userId', 'createdAt'])
export class ActivityLog {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Index('idx_activity_logs_tenant_id')
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @ManyToOne(() => Tenant, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant | null;

  @Index('idx_activity_logs_user_id')
  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'username', type: 'varchar', length: 100, nullable: true })
  username: string | null;

  @Index('idx_activity_logs_action')
  @Column({ name: 'action', type: 'varchar', length: 100 })
  action: string;

  @Index('idx_activity_logs_module')
  @Column({ name: 'module', type: 'varchar', length: 100 })
  module: string;

  @Column({ name: 'description', type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ name: 'method', type: 'varchar', length: 10, nullable: true })
  method: string | null;

  @Column({ name: 'path', type: 'varchar', length: 255, nullable: true })
  path: string | null;

  @Column({ name: 'params', type: 'jsonb', nullable: true })
  params: Record<string, any> | null;

  @Column({ name: 'body', type: 'jsonb', nullable: true })
  body: Record<string, any> | null;

  @Index('idx_activity_logs_created_at')
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
