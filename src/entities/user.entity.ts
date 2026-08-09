// src/users/user.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Role } from '../role/entities/role.entity';
import { TenantBaseEntity } from './tenant-base.entity';
import { Tenant } from '@entities/tenant.entity';
import { Permission } from './permission.entity';

@Entity('users')
export class User extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' }) // FK: role_id
  role: Role;

  @OneToMany(() => Permission, (permission) => permission.user)
  permissions: Permission[];

  @Column({ type: 'varchar', nullable: true })
  refreshToken: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  is_active: boolean;
}
