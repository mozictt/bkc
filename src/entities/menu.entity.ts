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
} from 'typeorm';
import { Role } from '@entities/role.entity';

@Entity('menus')
export class Menu {
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

  @ManyToMany(() => Role, (role) => role.menus)
  roles: Role[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
