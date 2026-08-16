import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';

@Entity('pegawai')
export class Pegawai extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nip: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', unique: true, nullable: true })
  email: string | null;

  @Column({ name: 'phone_number', type: 'varchar', nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'varchar', nullable: true })
  position: string | null;

  @Column({ type: 'varchar', nullable: true })
  avatar: string | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;
}
