import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Menu } from '@entities/menu.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ nullable: true })
  description: string;

  // @ManyToMany(() => Menu, (menu) => menu.roles, { cascade: true })
  @ManyToMany(() => Menu, (menu) => menu.roles, { eager: true })
  @JoinTable({
    name: 'role_menu', // Pivot table
    joinColumn: { name: 'role_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'menu_id', referencedColumnName: 'id' },
  })
  menus: Menu[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
