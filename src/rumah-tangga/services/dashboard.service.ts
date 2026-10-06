import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { TransactionType } from '../constants/transaction-type.enum';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    private readonly tenantService: TenantContextService,
  ) {}

  private get tenantId(): string {
    const id = this.tenantService.getTenantId();
    if (!id) throw new Error('Tenant Context not found!');
    return id;
  }

  /**
   * Ringkasan keuangan bulan ini:
   * - Total pemasukan
   * - Total pengeluaran
   * - Selisih (surplus/defisit)
   * - Perbandingan dengan bulan lalu
   */
  async getSummary(year: number, month: number) {
    const tid = this.tenantId;

    // Data bulan ini: total income & expense dalam satu query
    const currentMonth = await this.transactionRepo
      .createQueryBuilder('trx')
      .select('trx.type', 'type')
      .addSelect('COALESCE(SUM(trx.amount), 0)', 'total')
      .addSelect('COUNT(trx.id)', 'count')
      .where('trx.tenant_id = :tid', { tid })
      .andWhere('EXTRACT(YEAR FROM trx.transaction_date) = :year', { year })
      .andWhere('EXTRACT(MONTH FROM trx.transaction_date) = :month', { month })
      .andWhere('trx.deleted_at IS NULL')
      .groupBy('trx.type')
      .getRawMany();

    // Data bulan lalu untuk perbandingan
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;

    const previousMonth = await this.transactionRepo
      .createQueryBuilder('trx')
      .select('trx.type', 'type')
      .addSelect('COALESCE(SUM(trx.amount), 0)', 'total')
      .where('trx.tenant_id = :tid', { tid })
      .andWhere('EXTRACT(YEAR FROM trx.transaction_date) = :year', { year: prevYear })
      .andWhere('EXTRACT(MONTH FROM trx.transaction_date) = :month', { month: prevMonth })
      .andWhere('trx.deleted_at IS NULL')
      .groupBy('trx.type')
      .getRawMany();

    const parseResult = (rows: any[]) => {
      const income = Number(rows.find((r) => r.type === TransactionType.INCOME)?.total || 0);
      const expense = Number(rows.find((r) => r.type === TransactionType.EXPENSE)?.total || 0);
      const incomeCount = Number(rows.find((r) => r.type === TransactionType.INCOME)?.count || 0);
      const expenseCount = Number(rows.find((r) => r.type === TransactionType.EXPENSE)?.count || 0);
      return { income, expense, balance: income - expense, incomeCount, expenseCount };
    };

    const current = parseResult(currentMonth);
    const previous = parseResult(previousMonth);

    const expenseChange = previous.expense > 0
      ? Math.round(((current.expense - previous.expense) / previous.expense) * 100 * 10) / 10
      : 0;

    const incomeChange = previous.income > 0
      ? Math.round(((current.income - previous.income) / previous.income) * 100 * 10) / 10
      : 0;

    return {
      totalIncome: current.income,
      totalExpense: current.expense,
      netBalance: current.balance,
      incomeChangePercentage: incomeChange,
      expenseChangePercentage: expenseChange,
      netBalanceChangePercentage: 0,
      totalTransactionsCount: current.incomeCount + current.expenseCount,
      current,
      previous,
    };
  }

  /**
   * Data pengeluaran harian dalam satu bulan (untuk area/line chart).
   * Mengembalikan seluruh hari (1 - jumlah hari dalam bulan) untuk deret waktu lengkap.
   */
  async getDailyChart(year: number, month: number) {
    const tid = this.tenantId;

    const rawData = await this.transactionRepo
      .createQueryBuilder('trx')
      .select("TO_CHAR(trx.transaction_date, 'YYYY-MM-DD')", 'date')
      .addSelect('EXTRACT(DAY FROM trx.transaction_date)::int', 'day')
      .addSelect('trx.type', 'type')
      .addSelect('COALESCE(SUM(trx.amount), 0)', 'total')
      .where('trx.tenant_id = :tid', { tid })
      .andWhere('EXTRACT(YEAR FROM trx.transaction_date) = :year', { year })
      .andWhere('EXTRACT(MONTH FROM trx.transaction_date) = :month', { month })
      .andWhere('trx.deleted_at IS NULL')
      .groupBy('date')
      .addGroupBy('day')
      .addGroupBy('trx.type')
      .orderBy('date', 'ASC')
      .getRawMany();

    const daysInMonth = new Date(year, month, 0).getDate();
    const dailyMap = new Map<number, { income: number; expense: number }>();
    for (let d = 1; d <= daysInMonth; d++) {
      dailyMap.set(d, { income: 0, expense: 0 });
    }

    for (const r of rawData) {
      const day = Number(r.day);
      const item = dailyMap.get(day);
      if (item) {
        const total = Number(r.total);
        if (r.type === TransactionType.INCOME) {
          item.income += total;
        } else if (r.type === TransactionType.EXPENSE) {
          item.expense += total;
        }
      }
    }

    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      const formattedDay = day < 10 ? `0${day}` : `${day}`;
      const formattedMonth = month < 10 ? `0${month}` : `${month}`;
      const data = dailyMap.get(day)!;
      return {
        day,
        date: `${year}-${formattedMonth}-${formattedDay}`,
        income: data.income,
        expense: data.expense,
      };
    });
  }

  /**
   * Distribusi pengeluaran per kategori bulan ini (untuk pie/donut chart).
   */
  async getCategoryBreakdown(year: number, month: number) {
    const tid = this.tenantId;

    const result = await this.transactionRepo
      .createQueryBuilder('trx')
      .innerJoin('trx.category', 'cat')
      .select('cat.id', 'categoryId')
      .addSelect('cat.name', 'categoryName')
      .addSelect('cat.icon', 'icon')
      .addSelect('cat.color', 'color')
      .addSelect('COALESCE(SUM(trx.amount), 0)', 'total')
      .addSelect('COUNT(trx.id)', 'count')
      .where('trx.tenant_id = :tid', { tid })
      .andWhere('trx.type = :type', { type: TransactionType.EXPENSE })
      .andWhere('EXTRACT(YEAR FROM trx.transaction_date) = :year', { year })
      .andWhere('EXTRACT(MONTH FROM trx.transaction_date) = :month', { month })
      .andWhere('trx.deleted_at IS NULL')
      .groupBy('cat.id')
      .addGroupBy('cat.name')
      .addGroupBy('cat.icon')
      .addGroupBy('cat.color')
      .orderBy('total', 'DESC')
      .getRawMany();

    const grandTotal = result.reduce((sum, r) => sum + Number(r.total), 0);

    return result.map((row) => ({
      ...row,
      categoryId: Number(row.categoryId),
      totalAmount: Number(row.total),
      total: Number(row.total),
      count: Number(row.count),
      percentage: grandTotal > 0 ? Math.round((Number(row.total) / grandTotal) * 100 * 10) / 10 : 0,
    }));
  }

  /**
   * Pengeluaran per anggota keluarga bulan ini (untuk bar chart).
   */
  async getMemberBreakdown(year: number, month: number) {
    const tid = this.tenantId;

    const result = await this.transactionRepo
      .createQueryBuilder('trx')
      .leftJoin('trx.familyMember', 'fm')
      .select('fm.id', 'memberId')
      .addSelect("COALESCE(fm.name, 'Tidak Dicatat')", 'memberName')
      .addSelect('COALESCE(SUM(trx.amount), 0)', 'total')
      .addSelect('COUNT(trx.id)', 'count')
      .where('trx.tenant_id = :tid', { tid })
      .andWhere('trx.type = :type', { type: TransactionType.EXPENSE })
      .andWhere('EXTRACT(YEAR FROM trx.transaction_date) = :year', { year })
      .andWhere('EXTRACT(MONTH FROM trx.transaction_date) = :month', { month })
      .andWhere('trx.deleted_at IS NULL')
      .groupBy('fm.id')
      .addGroupBy('fm.name')
      .orderBy('total', 'DESC')
      .getRawMany();

    const grandTotal = result.reduce((sum, r) => sum + Number(r.total), 0);

    return result.map((row) => ({
      ...row,
      memberId: row.memberId ? Number(row.memberId) : 0,
      totalAmount: Number(row.total),
      total: Number(row.total),
      count: Number(row.count),
      percentage: grandTotal > 0 ? Math.round((Number(row.total) / grandTotal) * 100 * 10) / 10 : 0,
    }));
  }
}
