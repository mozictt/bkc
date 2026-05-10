import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  ManyToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
  Relation,
} from 'typeorm';
import { Role } from './role.entity';
import { RoleMenuPermission } from './role-menu-permissions.entity';
import { TenantBaseEntity } from './tenant-base.entity';

@Entity('menus')
export class Menu extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ nullable: true })
  url: string;

  @Column({ default: 0 })
  order_no: number;

  @Column({ default: true })
  is_active: boolean;

  @ManyToOne(() => Menu, (menu) => menu.children, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_id' }) // 👈 ini penting
  parent: Menu;

  @OneToMany(() => Menu, (menu) => menu.parent)
  children: Menu[];

  @OneToMany(() => RoleMenuPermission, (rmp) => rmp.menu)
  permissions: Relation<RoleMenuPermission>[];
}
