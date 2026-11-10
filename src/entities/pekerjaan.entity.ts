import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';
import { TenantNoSoftDeleteBaseEntity } from './tenant-base.entity';

@Entity('pekerjaan')
export class Pekerjaan extends TenantNoSoftDeleteBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  nama: string;

  @Column({ default: 'Y' })
  status: string;
}
