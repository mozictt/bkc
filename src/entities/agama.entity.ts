import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { TenantNoSoftDeleteBaseEntity } from './tenant-base.entity';

@Entity('agama')
export class Agama extends TenantNoSoftDeleteBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nama: string;

  @Column({ default: 'Y' })
  status: string;
}
