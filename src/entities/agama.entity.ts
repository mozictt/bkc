import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';

@Entity('agama')
export class Agama extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nama: string;

  @Column({ default: 'Y' })
  status: string;
}

