import { Entity, Column, PrimaryColumn } from 'typeorm';
import { TenantBaseEntity } from '@entities/tenant-base.entity';

@Entity('whatsapp_devices')
export class WhatsappDevice extends TenantBaseEntity {
  @PrimaryColumn({ type: 'varchar', length: 50 })
  id: string; // deviceId yang dikirim dari request / session name

  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string | null;

  @Column({ name: 'phone_number', type: 'varchar', length: 30, nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'varchar', length: 20, default: 'disconnected' })
  status: string; // 'connecting', 'connected', 'disconnected'
}
