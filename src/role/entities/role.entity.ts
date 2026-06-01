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
import { TenantBaseEntity } from '../../entities/tenant-base.entity';
import { RoleMenuPermission } from '../../entities/role-menu-permissions.entity';
import { Menu } from '../../entities/menu.entity';

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
