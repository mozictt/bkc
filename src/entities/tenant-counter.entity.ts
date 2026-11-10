import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('tenant_counters')
@Index('uq_tenant_counters_tenant_key', ['tenantId', 'counterKey'], {
  unique: true,
})
export class TenantCounter {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'tenant_id', type: 'uuid' })
  tenantId: string;

  @Column({ name: 'counter_key', type: 'varchar', length: 50 })
  counterKey: string;

  @Column({ name: 'last_value', type: 'bigint', default: '0' })
  lastValue: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

