import { Column, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from './tenant.entity';

export abstract class TenantBaseEntity {
  @Column({ name: 'tenant_id', type: 'uuid', nullable: true })
  tenantId: string | null;

  @ManyToOne(() => Tenant, { nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}