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
import { Role } from '../role/entities/role.entity';
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

  @Column({ default: true })
  is_visible: boolean;

  @Column({ name: 'required_resource', type: 'varchar', nullable: true })
  requiredResource: string;

  @ManyToOne(() => Menu, (menu) => menu.children, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'parent_id' }) // 👈 ini penting
  parent: Menu;

  @OneToMany(() => Menu, (menu) => menu.parent)
  children: Menu[];
}
