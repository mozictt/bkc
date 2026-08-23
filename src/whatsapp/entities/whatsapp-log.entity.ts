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

  @Column({ name: 'media_url', type: 'varchar', length: 255, nullable: true })
  mediaUrl: string | null;

  @Column({ name: 'participant_jid', type: 'varchar', length: 100, nullable: true })
  participantJid: string | null;

  @Column({ name: 'quoted_message_id', type: 'varchar', length: 100, nullable: true })
  quotedMessageId: string | null;

  @Column({ name: 'chat_type', type: 'varchar', length: 20, default: 'PERSONAL' })
  chatType: 'PERSONAL' | 'GROUP';
}
