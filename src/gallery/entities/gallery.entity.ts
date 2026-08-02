import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Album } from './album.entity';
import { TenantBaseEntity } from '@entities/tenant-base.entity';

@Entity('galleries')
export class Gallery extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Hapus title dan description karena sudah diwakilkan oleh Album

  @Column({ type: 'varchar', length: 255 })
  fileName: string;

  @Column({ type: 'varchar', length: 255 })
  originalName: string;

  @Column({ type: 'varchar', length: 100 })
  mimeType: string;

  @Column({ type: 'int' })
  size: number;

  @Column({ type: 'varchar', length: 500 })
  path: string;

  @Column({ type: 'enum', enum: ['photo', 'video'] })
  type: 'photo' | 'video';

  @ManyToOne(() => Album, (album) => album.galleries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'album_id' })
  album: Album;

  @Column({ name: 'album_id', type: 'uuid', nullable: true })
  albumId: string;
}
