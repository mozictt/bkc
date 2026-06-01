import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Relation,
} from 'typeorm';
import { Role } from '../role/entities/role.entity';
import { Menu } from './menu.entity';
import { MenuAction } from './enums/menu-action.enum';
import { TenantBaseEntity } from './tenant-base.entity';

@Entity('role_menu_permissions')
export class RoleMenuPermission extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Role, (role) => role.permissions)
  @JoinColumn({ name: 'role_id' })
  role: Relation<Role>; // Gunakan Relation wrapper

  @ManyToOne(() => Menu, (menu) => menu.permissions)
  @JoinColumn({ name: 'menu_id' })
  menu: Relation<Menu>;

  @Column({
    type: 'jsonb', // 'jsonb' lebih baik jika pakai Postgres
    default: [],
  })
  actions: MenuAction[];
}
