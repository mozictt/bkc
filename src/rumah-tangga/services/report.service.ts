import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../entities/transaction.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { TransactionType } from '../constants/transaction-type.enum';

@Injectable()
export class ReportService {
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
   * Laporan bulanan: total pemasukan vs pengeluaran per bulan dalam setahun (12 bulan Jan-Des).
   */
  async getMonthlyReport(year: number) {
    const tid = this.tenantId;

    const rawData = await this.transactionRepo
      .createQueryBuilder('trx')
      .select('EXTRACT(MONTH FROM trx.transaction_date)::int', 'month')
      .addSelect('trx.type', 'type')
      .addSelect('COALESCE(SUM(trx.amount), 0)', 'total')
      .addSelect('COUNT(trx.id)', 'count')
      .where('trx.tenant_id = :tid', { tid })
      .andWhere('EXTRACT(YEAR FROM trx.transaction_date) = :year', { year })
      .andWhere('trx.deleted_at IS NULL')
      .groupBy('month')
      .addGroupBy('trx.type')
      .orderBy('month', 'ASC')
      .getRawMany();

    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];

    const monthlyMap = new Map<number, { income: number; expense: number }>();
    for (let m = 1; m <= 12; m++) {
      monthlyMap.set(m, { income: 0, expense: 0 });
    }

    for (const row of rawData) {
      const m = Number(row.month);
      const total = Number(row.total);
      const entry = monthlyMap.get(m);
      if (entry) {
        if (row.type === TransactionType.INCOME) {
          entry.income += total;
        } else if (row.type === TransactionType.EXPENSE) {
          entry.expense += total;
        }
      }
    }

    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const data = monthlyMap.get(month)!;
      return {
        month,
        monthName: monthNames[i],
        income: data.income,
        expense: data.expense,
        net: data.income - data.expense,
      };
    });
  }

  /**
   * Tren pengeluaran 6 bulan terakhir (line/bar chart).
   */
  async getTrend(months = 6) {
    const tid = this.tenantId;

    const rawData = await this.transactionRepo
      .createQueryBuilder('trx')
      .select("TO_CHAR(trx.transaction_date, 'YYYY-MM')", 'period')
      .addSelect('EXTRACT(YEAR FROM trx.transaction_date)::int', 'year')
      .addSelect('EXTRACT(MONTH FROM trx.transaction_date)::int', 'month')
      .addSelect('trx.type', 'type')
      .addSelect('COALESCE(SUM(trx.amount), 0)', 'total')
      .where('trx.tenant_id = :tid', { tid })
      .andWhere("trx.transaction_date >= (CURRENT_DATE - INTERVAL '1 month' * :months)", { months })
      .andWhere('trx.deleted_at IS NULL')
      .groupBy('period')
      .addGroupBy('year')
      .addGroupBy('month')
      .addGroupBy('trx.type')
      .orderBy('period', 'ASC')
      .getRawMany();

    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
    ];

    const periodMap = new Map<string, { year: number; month: number; income: number; expense: number }>();

    for (const row of rawData) {
      const p = String(row.period);
      if (!periodMap.has(p)) {
        periodMap.set(p, {
          year: Number(row.year),
          month: Number(row.month),
          income: 0,
          expense: 0,
        });
      }
      const item = periodMap.get(p)!;
      const total = Number(row.total);
      if (row.type === TransactionType.INCOME) {
        item.income += total;
      } else if (row.type === TransactionType.EXPENSE) {
        item.expense += total;
      }
    }

    return Array.from(periodMap.entries()).map(([period, val]) => ({
      period,
      year: val.year,
      month: val.month,
      monthName: monthNames[val.month - 1] || `Bulan ${val.month}`,
      income: val.income,
      expense: val.expense,
      net: val.income - val.expense,
    }));
  }

  /**
   * Laporan pengeluaran per kategori untuk bulan/tahun tertentu.
   */
  async getCategoryReport(year: number, month?: number) {
    const tid = this.tenantId;

    const qb = this.transactionRepo
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
      .andWhere('trx.deleted_at IS NULL');

    if (month) {
      qb.andWhere('EXTRACT(MONTH FROM trx.transaction_date) = :month', { month });
    }

    const result = await qb
      .groupBy('cat.id')
      .addGroupBy('cat.name')
      .addGroupBy('cat.icon')
      .addGroupBy('cat.color')
      .orderBy('total', 'DESC')
      .getRawMany();

    const grandTotal = result.reduce((sum, row) => sum + Number(row.total), 0);

    return result.map((row) => ({
      ...row,
      totalAmount: Number(row.total),
      total: Number(row.total),
      count: Number(row.count),
      percentage: grandTotal > 0
        ? Math.round((Number(row.total) / grandTotal) * 100 * 10) / 10
        : 0,
    }));
  }

  /**
   * Laporan pengeluaran rutin (is_recurring = true).
   */
  async getRecurringReport(year: number, month?: number) {
    const tid = this.tenantId;

    const qb = this.transactionRepo
      .createQueryBuilder('trx')
      .innerJoin('trx.category', 'cat')
      .select('trx.id', 'id')
      .addSelect('cat.id', 'categoryId')
      .addSelect('cat.name', 'categoryName')
      .addSelect('cat.icon', 'icon')
      .addSelect('trx.description', 'title')
      .addSelect('trx.description', 'description')
      .addSelect('trx.amount', 'amount')
      .addSelect('trx.transaction_date', 'transactionDate')
      .where('trx.tenant_id = :tid', { tid })
      .andWhere('trx.type = :type', { type: TransactionType.EXPENSE })
      .andWhere('trx.is_recurring = :isRecurring', { isRecurring: true })
      .andWhere('EXTRACT(YEAR FROM trx.transaction_date) = :year', { year })
      .andWhere('trx.deleted_at IS NULL');

    if (month) {
      qb.andWhere('EXTRACT(MONTH FROM trx.transaction_date) = :month', { month });
    }

    const rows = await qb.orderBy('trx.transaction_date', 'ASC').getRawMany();

    return rows.map((r) => ({
      ...r,
      amount: Number(r.amount),
      category: {
        id: r.categoryId,
        name: r.categoryName,
        icon: r.icon,
      },
    }));
  }
}
