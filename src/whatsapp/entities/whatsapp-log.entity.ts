import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from '@entities/tenant-base.entity';

@Entity('whatsapp_logs')
export class WhatsappLog extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'device_id', type: 'varchar', length: 50 })
  deviceId: string;

  @Column({ name: 'phone_number', type: 'varchar', length: 30 })
  phoneNumber: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 10 }) // 'IN' untuk pesan masuk, 'OUT' untuk pesan keluar
  direction: 'IN' | 'OUT';

  @Column({ name: 'message_id', type: 'varchar', length: 100, nullable: true })
  messageId: string | null;
}
