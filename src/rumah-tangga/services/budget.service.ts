import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BudgetPlan } from '../entities/budget-plan.entity';
import { ExpenseCategory } from '../entities/expense-category.entity';
import { Transaction } from '../entities/transaction.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { BaseTenantService } from '../../common/tenant/base-tenant.service';
import { CreateBudgetDto } from '../dto/create-budget.dto';
import { TransactionType } from '../constants/transaction-type.enum';
import { CategoryType } from '../constants/category-type.enum';
import { tenantLeftJoin } from '../../common/utils/query-utils';

@Injectable()
export class BudgetService extends BaseTenantService<BudgetPlan> {
  constructor(
    @InjectRepository(BudgetPlan)
    private readonly budgetRepo: Repository<BudgetPlan>,
    @InjectRepository(ExpenseCategory)
    private readonly categoryRepo: Repository<ExpenseCategory>,
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    tenantService: TenantContextService,
  ) {
    super(budgetRepo, tenantService, 'bp');
  }

  /**
   * Mengambil daftar anggaran per bulan, beserta realisasinya.
   * Query dioptimasi: join kategori + subquery realisasi dalam satu query.
   */
  async findByPeriod(year: number, month: number) {
    const tid = this.tenantId;

    const qb = this.createQuery();
    tenantLeftJoin(qb, 'bp.category', 'cat', tid);

    qb.andWhere('bp.periodYear = :year', { year })
      .andWhere('bp.periodMonth = :month', { month })
      .orderBy('cat.orderNo', 'ASC')
      .addOrderBy('cat.name', 'ASC');

    const budgets = await qb.getMany();

    // Ambil realisasi pengeluaran per kategori dalam satu query (hindari N+1)
    const categoryIds = budgets.map((b) => b.categoryId);

    if (categoryIds.length === 0) {
      return [];
    }

    const realizations = await this.transactionRepo
      .createQueryBuilder('trx')
      .select('trx.category_id', 'categoryId')
      .addSelect('COALESCE(SUM(trx.amount), 0)', 'usedAmount')
      .where('trx.tenant_id = :tid', { tid })
      .andWhere('trx.type = :type', { type: TransactionType.EXPENSE })
      .andWhere('trx.category_id IN (:...categoryIds)', { categoryIds })
      .andWhere('EXTRACT(YEAR FROM trx.transaction_date) = :year', { year })
      .andWhere('EXTRACT(MONTH FROM trx.transaction_date) = :month', { month })
      .andWhere('trx.deleted_at IS NULL')
      .groupBy('trx.category_id')
      .getRawMany();

    // Map realisasi ke budget dalam O(1) lookup
    const realizationMap = new Map(
      realizations.map((r) => [Number(r.categoryId), Number(r.usedAmount)]),
    );

    return budgets.map((budget) => {
      const usedAmount = realizationMap.get(budget.categoryId) || 0;
      const budgetAmount = Number(budget.budgetAmount);
      return {
        ...budget,
        budgetAmount,
        usedAmount,
        remainingAmount: budgetAmount - usedAmount,
        percentage: budgetAmount > 0
          ? Math.round((usedAmount / budgetAmount) * 100 * 10) / 10
          : 0,
      };
    });
  }

  /**
   * Upsert anggaran: buat baru jika belum ada, update/restore jika sudah ada (termasuk soft-deleted).
   * Unik berdasarkan: tenant_id + category_id + period_year + period_month.
   */
  async upsert(dto: CreateBudgetDto): Promise<BudgetPlan> {
    const tid = this.tenantId;

    // Validasi kategori milik tenant dan merupakan kategori pengeluaran
    const category = await this.categoryRepo.findOne({
      where: [
        { id: dto.categoryId, tenantId: tid, type: CategoryType.PENGELUARAN },
        { id: dto.categoryId, type: CategoryType.PENGELUARAN },
      ],
    });

    if (!category) {
      throw new NotFoundException('Kategori pengeluaran tidak ditemukan');
    }

    // Cari budget existing (termasuk yang soft-deleted)
    let budget = await this.createQuery()
      .withDeleted()
      .andWhere('bp.categoryId = :categoryId', { categoryId: dto.categoryId })
      .andWhere('bp.periodYear = :year', { year: dto.periodYear })
      .andWhere('bp.periodMonth = :month', { month: dto.periodMonth })
      .getOne();

    if (budget) {
      budget.budgetAmount = dto.budgetAmount;
      budget.notes = dto.notes ?? budget.notes;
      budget.deletedAt = null as any; // Restore dari soft-delete jika ada
    } else {
      budget = this.budgetRepo.create({
        ...dto,
        tenantId: tid,
      });
    }

    return this.budgetRepo.save(budget);
  }

  async remove(id: number): Promise<void> {
    const budget = await this.findOneById(id);
    await this.budgetRepo.remove(budget);
  }

  /**
   * Salin anggaran dari bulan sebelumnya ke bulan target.
   *
   * Logika:
   * 1. Tentukan periode sumber (bulan sebelumnya dari target).
   * 2. Ambil semua anggaran di periode sumber milik tenant.
   * 3. Untuk setiap item, upsert ke periode target.
   *    - Jika sudah ada (dan tidak soft-deleted) → lewati (opsional bisa overwrite).
   *    - Jika belum ada / soft-deleted → buat/restore.
   *
   * @param targetYear  Tahun periode target
   * @param targetMonth Bulan periode target (1-12)
   * @param overwrite   Jika true, overwrite budget yang sudah ada di target
   * @returns Ringkasan: { generated, skipped, sourceMonth, sourceYear }
   */
  async generateFromPrevious(
    targetYear: number,
    targetMonth: number,
    overwrite = false,
  ): Promise<{
    generated: number;
    skipped: number;
    sourceMonth: number;
    sourceYear: number;
    items: BudgetPlan[];
  }> {
    const tid = this.tenantId;

    // Hitung periode sumber (bulan sebelumnya)
    const sourceDate = new Date(targetYear, targetMonth - 2, 1); // month-2 karena Date bulan 0-indexed
    const sourceYear = sourceDate.getFullYear();
    const sourceMonth = sourceDate.getMonth() + 1;

    // Ambil anggaran bulan sumber (hanya yang aktif / tidak soft-deleted)
    const sourceBudgets = await this.budgetRepo.find({
      where: {
        tenantId: tid,
        periodYear: sourceYear,
        periodMonth: sourceMonth,
      },
      relations: ['category'],
    });

    if (sourceBudgets.length === 0) {
      return { generated: 0, skipped: 0, sourceMonth, sourceYear, items: [] };
    }

    // Ambil data anggaran yang sudah ada di periode target (batch query — hindari N+1)
    const existingBudgets = await this.budgetRepo
      .createQueryBuilder('bp')
      .where('bp.tenant_id = :tid', { tid })
      .andWhere('bp.period_year = :year', { year: targetYear })
      .andWhere('bp.period_month = :month', { month: targetMonth })
      .withDeleted()
      .getMany();

    const existingMap = new Map(existingBudgets.map((b) => [b.categoryId, b]));

    let generated = 0;
    let skipped = 0;
    const savedItems: BudgetPlan[] = [];

    for (const src of sourceBudgets) {
      const existing = existingMap.get(src.categoryId);

      if (existing && !existing.deletedAt && !overwrite) {
        // Sudah ada dan tidak diminta overwrite → lewati
        skipped++;
        continue;
      }

      if (existing) {
        // Update / restore
        existing.budgetAmount = src.budgetAmount;
        existing.notes = src.notes;
        existing.deletedAt = null as any;
        const saved = await this.budgetRepo.save(existing);
        savedItems.push(saved);
      } else {
        // Buat baru
        const newBudget = this.budgetRepo.create({
          tenantId: tid,
          categoryId: src.categoryId,
          periodYear: targetYear,
          periodMonth: targetMonth,
          budgetAmount: src.budgetAmount,
          notes: src.notes,
        });
        const saved = await this.budgetRepo.save(newBudget);
        savedItems.push(saved);
      }

      generated++;
    }

    return { generated, skipped, sourceMonth, sourceYear, items: savedItems };
  }
}
