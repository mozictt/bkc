import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { TenantBaseEntity } from '@entities/tenant-base.entity';
import { TransactionType } from '../constants/transaction-type.enum';
import { ExpenseCategory } from './expense-category.entity';
import { FamilyMember } from './family-member.entity';

@Entity('rt_transactions')
export class Transaction extends TenantBaseEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({
    type: 'enum',
    enum: TransactionType,
  })
  type: TransactionType;

  @Index()
  @Column({ name: 'category_id' })
  categoryId: number;

  @ManyToOne(() => ExpenseCategory, (cat) => cat.transactions, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'category_id' })
  category: ExpenseCategory;

  @Column({ name: 'family_member_id', nullable: true })
  familyMemberId: number | null;

  @ManyToOne(() => FamilyMember, (fm) => fm.transactions, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'family_member_id' })
  familyMember: FamilyMember;

  @Column({ length: 255 })
  description: string;

  /** Nominal dalam Rupiah (tanpa desimal) */
  @Column({ type: 'bigint' })
  amount: number;

  @Index()
  @Column({ name: 'transaction_date', type: 'date' })
  transactionDate: string;

  /** Path foto bukti transaksi (struk/nota), opsional */
  @Column({ name: 'receipt_photo', nullable: true })
  receiptPhoto: string;

  @Column({ type: 'text', nullable: true })
  notes: string;

  /** Penanda apakah ini pengeluaran rutin (listrik, air, cicilan, dll) */
  @Column({ name: 'is_recurring', default: false })
  isRecurring: boolean;
}
