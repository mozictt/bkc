import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  ManyToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinTable,
  Index,
} from 'typeorm';
import { TenantBaseEntity } from '../../entities/tenant-base.entity';
import { Permission } from '../../entities/permission.entity';
import { Menu } from '../../entities/menu.entity';

@Entity('roles')
@Index(['name', 'tenantId'], { unique: true })
export class Role extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @OneToMany(() => Permission, (permission) => permission.role, {
    cascade: true,
  })
  permissions: Permission[];
}
