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
} from 'typeorm';
import { TenantBaseEntity } from './tenant-base.entity';
import { RoleMenuPermission } from './role-menu-permissions.entity';
import { Menu } from './menu.entity';

@Entity('roles')
export class Role extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  @OneToMany(() => RoleMenuPermission, (rmp) => rmp.role, {
    cascade: true,
  })
  permissions: RoleMenuPermission[];
}
