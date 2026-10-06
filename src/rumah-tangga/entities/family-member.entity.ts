import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
import { TenantBaseEntity } from '@entities/tenant-base.entity';
import type { Transaction } from './transaction.entity';

@Entity('rt_family_members')
export class FamilyMember extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  /** Peran dalam keluarga: Ayah, Ibu, Anak, dll */
  @Column({ length: 50, nullable: true })
  role: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany('Transaction', 'familyMember')
  transactions: Transaction[];
}
