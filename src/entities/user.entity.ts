// src/users/user.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Role } from './role.entity';
import { TenantBaseEntity } from './tenant-base.entity';

@Entity('users')
export class User extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @ManyToOne(() => Role, { eager: true }) // 👈 eager = auto load saat user diambil
  @JoinColumn({ name: 'role_id' }) // FK: role_id
  role: Role;

  @Column({ nullable: true})
  refreshToken: string;
}
