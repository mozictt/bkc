// src/users/user.entity.ts
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Role } from '../role/entities/role.entity';
import { TenantBaseEntity } from './tenant-base.entity';
import { Tenant } from '@entities/tenant.entity';

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

  @ManyToOne(() => Tenant)
  @JoinColumn({ name: 'tenant_id' }) // Sesuaikan dengan nama kolom foreign key asli di tabel users DB kamu
  tenant: Tenant;

  @Column({ nullable: true })
  refreshToken: string;
}
