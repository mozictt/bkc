import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  Index,
} from 'typeorm';
import { TenantBaseEntity } from '@entities/tenant-base.entity';
import { CategoryType } from '../constants/category-type.enum';
import type { Transaction } from './transaction.entity';
import type { BudgetPlan } from './budget-plan.entity';

@Entity('rt_expense_categories')
export class ExpenseCategory extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 50, nullable: true })
  icon: string;

  @Index()
  @Column({
    type: 'enum',
    enum: CategoryType,
    default: CategoryType.PENGELUARAN,
  })
  type: CategoryType;

  /** Warna HEX untuk visualisasi chart (misal: #FF6384) */
  @Column({ length: 7, nullable: true })
  color: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'order_no', default: 0 })
  orderNo: number;

  @OneToMany('Transaction', 'category')
  transactions: Transaction[];

  @OneToMany('BudgetPlan', 'category')
  budgetPlans: BudgetPlan[];
}
