import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { TenantBaseEntity } from '@entities/tenant-base.entity';
import { User } from '@entities/user.entity';

/**
 * Entitas kontak — merepresentasikan relasi kontak antar user dalam satu tenant.
 * Unique constraint mencegah duplikasi kontak untuk pasangan owner + contact yang sama.
 */
@Entity('chat_contacts')
@Unique(['tenantId', 'ownerId', 'contactUserId'])
export class ChatContact extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'owner_id', type: 'int' })
  ownerId: number;

  /** User pemilik daftar kontak */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Index()
  @Column({ name: 'contact_user_id', type: 'int' })
  contactUserId: number;

  /** User yang ditambahkan sebagai kontak */
  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_user_id' })
  contactUser: User;

  /** Nama alias/panggilan untuk kontak ini */
  @Column({ type: 'varchar', length: 100, nullable: true })
  nickname: string | null;

  /** Apakah kontak ini diblokir oleh owner */
  @Column({ name: 'is_blocked', type: 'boolean', default: false })
  isBlocked: boolean;
}
