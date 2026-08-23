import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { TenantBaseEntity } from '../../entities/tenant-base.entity';

@Entity('whatsapp_contacts')
export class WhatsappContact extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'jid', type: 'varchar' })
  jid: string;

  @Column({ name: 'phone_number', type: 'varchar' })
  phoneNumber: string;

  @Column({ name: 'name', type: 'varchar', nullable: true })
  name: string;

  @Column({ name: 'push_name', type: 'varchar', nullable: true })
  pushName: string;

  @Column({ name: 'profile_picture_url', type: 'text', nullable: true })
  profilePictureUrl: string;

  @Column({ name: 'is_registered', type: 'boolean', default: true })
  isRegistered: boolean;
}
