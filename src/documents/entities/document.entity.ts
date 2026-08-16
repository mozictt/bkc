import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantBaseEntity } from '@entities/tenant-base.entity';
import { User } from '@entities/user.entity';

@Entity('documents')
@Index(['tenantId', 'createdAt']) // Composite index for tenant sorting and pagination
export class Document extends TenantBaseEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  fileName: string; // Stored relative path: "slug/documents/filename.ext"

  @Index()
  @Column({ type: 'varchar', length: 255 })
  originalName: string; // Original uploaded file name

  @Column({ type: 'varchar', length: 150 })
  mimeType: string;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  extension: string; // Extracted lowercase file extension

  @Column({ type: 'bigint' })
  size: number; // File size in bytes

  @Column({ type: 'varchar', length: 500 })
  path: string; // The download path: "/documents/download/slug/documents/filename.ext"

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'uploaded_by_id', type: 'int' })
  uploadedById: number;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'uploaded_by_id' })
  uploadedBy: User;
}
