import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { TenantBaseEntity } from '@entities/tenant-base.entity';
import { ExpenseCategory } from './expense-category.entity';

/**
 * Rencana anggaran per kategori per bulan.
 * Unique constraint: satu kategori hanya punya satu budget per bulan per tenant.
 */
@Entity('rt_budget_plans')
@Unique(['tenantId', 'categoryId', 'periodYear', 'periodMonth'])
export class BudgetPlan extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'category_id' })
  categoryId: number;

  @ManyToOne(() => ExpenseCategory, (cat) => cat.budgetPlans, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'category_id' })
  category: ExpenseCategory;

  @Column({ name: 'period_year', type: 'int' })
  periodYear: number;

  @Column({ name: 'period_month', type: 'int' })
  periodMonth: number;

  /** Nominal anggaran dalam Rupiah */
  @Column({ name: 'budget_amount', type: 'bigint' })
  budgetAmount: number;

  @Column({ type: 'text', nullable: true })
  notes: string;
}
