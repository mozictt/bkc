import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Gallery } from './gallery.entity';
import { TenantBaseEntity } from '@entities/tenant-base.entity';

@Entity('albums')
export class Album extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'date', nullable: true })
  date: Date;

  @OneToMany(() => Gallery, (gallery) => gallery.album, { cascade: true })
  galleries: Gallery[];
}
