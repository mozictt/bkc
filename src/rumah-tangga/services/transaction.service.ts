import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as fs from 'fs';
import { join } from 'path';
import { Transaction } from '../entities/transaction.entity';
import { ExpenseCategory } from '../entities/expense-category.entity';
import { FamilyMember } from '../entities/family-member.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { BaseTenantService } from '../../common/tenant/base-tenant.service';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { UpdateTransactionDto } from '../dto/update-transaction.dto';
import { TransactionFilterDto } from '../dto/transaction-filter.dto';
import { tenantLeftJoin } from '../../common/utils/query-utils';

@Injectable()
export class TransactionService extends BaseTenantService<Transaction> {
  constructor(
    @InjectRepository(Transaction)
    private readonly transactionRepo: Repository<Transaction>,
    @InjectRepository(ExpenseCategory)
    private readonly categoryRepo: Repository<ExpenseCategory>,
    @InjectRepository(FamilyMember)
    private readonly memberRepo: Repository<FamilyMember>,
    tenantService: TenantContextService,
  ) {
    super(transactionRepo, tenantService, 'trx');
  }

  /**
   * Mengambil daftar transaksi dengan filter, pagination, dan sorting.
   * Eager load kategori dan anggota keluarga dalam satu query (menghindari N+1).
   */
  async findAll(filter: TransactionFilterDto) {
    const page = Math.max(1, filter.page || 1);
    const limit = Math.max(1, Math.min(100, filter.limit || 10));
    const tid = this.tenantService.getTenantId();

    const qb = this.createQuery();

    // Eager load relasi dalam satu query (hindari N+1)
    tenantLeftJoin(qb, 'trx.category', 'cat', tid);
    tenantLeftJoin(qb, 'trx.familyMember', 'fm', tid);

    // Filter berdasarkan tipe transaksi
    if (filter.type) {
      qb.andWhere('trx.type = :type', { type: filter.type });
    }

    // Filter berdasarkan kategori
    if (filter.categoryId) {
      qb.andWhere('trx.categoryId = :categoryId', {
        categoryId: filter.categoryId,
      });
    }

    // Filter berdasarkan anggota keluarga
    if (filter.familyMemberId) {
      qb.andWhere('trx.familyMemberId = :familyMemberId', {
        familyMemberId: filter.familyMemberId,
      });
    }

    // Filter berdasarkan rentang tanggal
    if (filter.startDate) {
      qb.andWhere('trx.transactionDate >= :startDate', {
        startDate: filter.startDate,
      });
    }
    if (filter.endDate) {
      qb.andWhere('trx.transactionDate <= :endDate', {
        endDate: filter.endDate,
      });
    }

    // Filter pengeluaran rutin
    if (filter.isRecurring !== undefined) {
      qb.andWhere('trx.isRecurring = :isRecurring', {
        isRecurring: filter.isRecurring,
      });
    }

    // Pencarian di deskripsi
    if (filter.search) {
      qb.andWhere('UPPER(trx.description) LIKE :search', {
        search: `%${filter.search.toUpperCase()}%`,
      });
    }

    // Sorting (whitelist kolom yang diizinkan)
    const allowedSort = ['id', 'transactionDate', 'amount', 'description', 'type'];
    const sortBy = allowedSort.includes(filter.sortBy || '')
      ? filter.sortBy
      : 'transactionDate';
    const sortType = (filter.sortType || 'DESC').toUpperCase() as 'ASC' | 'DESC';

    const [data, total] = await qb
      .orderBy(`trx.${sortBy}`, sortType)
      .addOrderBy('trx.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      success: true,
      currentPage: page,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
      array: data,
    };
  }

  async findOne(id: number): Promise<Transaction> {
    const tid = this.tenantService.getTenantId();
    const qb = this.createQuery();

    tenantLeftJoin(qb, 'trx.category', 'cat', tid);
    tenantLeftJoin(qb, 'trx.familyMember', 'fm', tid);

    const transaction = await qb
      .andWhere('trx.id = :id', { id })
      .getOne();

    if (!transaction) {
      throw new NotFoundException('Transaksi tidak ditemukan');
    }
    return transaction;
  }

  async create(dto: CreateTransactionDto): Promise<Transaction> {
    // Validasi kategori milik tenant yang sama
    const category = await this.categoryRepo.findOneBy({
      id: dto.categoryId,
      tenantId: this.tenantId,
    } as any);

    if (!category) {
      throw new BadRequestException('Kategori tidak ditemukan');
    }

    // Validasi anggota keluarga jika diisi
    if (dto.familyMemberId) {
      const member = await this.memberRepo.findOneBy({
        id: dto.familyMemberId,
        tenantId: this.tenantId,
      } as any);

      if (!member) {
        throw new BadRequestException('Anggota keluarga tidak ditemukan');
      }
    }

    const transaction = this.transactionRepo.create({
      ...dto,
      tenantId: this.tenantId,
    });
    return this.transactionRepo.save(transaction);
  }

  async update(id: number, dto: UpdateTransactionDto): Promise<Transaction> {
    const transaction = await this.findOne(id);

    // Validasi kategori jika diubah
    if (dto.categoryId && dto.categoryId !== transaction.categoryId) {
      const category = await this.categoryRepo.findOneBy({
        id: dto.categoryId,
        tenantId: this.tenantId,
      } as any);

      if (!category) {
        throw new BadRequestException('Kategori tidak ditemukan');
      }
    }

    // Validasi anggota keluarga jika diubah
    if (dto.familyMemberId !== undefined && dto.familyMemberId !== transaction.familyMemberId) {
      if (dto.familyMemberId) {
        const member = await this.memberRepo.findOneBy({
          id: dto.familyMemberId,
          tenantId: this.tenantId,
        } as any);

        if (!member) {
          throw new BadRequestException('Anggota keluarga tidak ditemukan');
        }
      }
    }

    Object.assign(transaction, dto);
    return this.transactionRepo.save(transaction);
  }

  /**
   * Update path foto bukti transaksi dengan pembersihan file lama secara aman.
   */
  async updateReceipt(id: number, receiptPhoto: string): Promise<Transaction> {
    const transaction = await this.findOne(id);

    // Pembersihan fisik berkas lama jika berbeda
    if (transaction.receiptPhoto && transaction.receiptPhoto !== receiptPhoto) {
      try {
        const oldAbsPath = join(process.cwd(), 'public', transaction.receiptPhoto.replace(/^[\/\\]+/, ''));
        if (fs.existsSync(oldAbsPath)) {
          fs.unlinkSync(oldAbsPath);
        }
      } catch (err) {
        console.warn(`[TransactionService] Gagal menghapus berkas struk lama: ${transaction.receiptPhoto}`, err);
      }
    }

    transaction.receiptPhoto = receiptPhoto;
    return this.transactionRepo.save(transaction);
  }

  async remove(id: number): Promise<void> {
    const transaction = await this.findOne(id);
    await this.transactionRepo.softRemove(transaction);
  }

  /**
   * Salin transaksi PEMASUKAN RUTIN (isRecurring=true) dari bulan sebelumnya ke bulan target.
   *
   * Logika:
   * 1. Hitung periode sumber (bulan sebelumnya dari target).
   * 2. Ambil semua transaksi PEMASUKAN + isRecurring=true di periode sumber.
   * 3. Untuk setiap item, buat salinan baru di periode target.
   *    - Tanggal: hari yang sama, namun di bulan/tahun target (jika melebihi akhir bulan, gunakan hari terakhir).
   *    - Receipt/foto tidak disalin (kwitansi berbeda per bulan).
   *
   * @param targetYear  Tahun periode target
   * @param targetMonth Bulan periode target (1-12)
   * @returns Ringkasan: { generated, sourceMonth, sourceYear, items }
   */
  async generateIncomeFromPrevious(
    targetYear: number,
    targetMonth: number,
  ): Promise<{
    generated: number;
    skipped: number;
    sourceMonth: number;
    sourceYear: number;
    items: Transaction[];
  }> {
    const tid = this.tenantId;

    // Hitung periode sumber (bulan sebelumnya)
    const sourceDate = new Date(targetYear, targetMonth - 2, 1);
    const sourceYear = sourceDate.getFullYear();
    const sourceMonth = sourceDate.getMonth() + 1;

    // Ambil transaksi pemasukan rutin bulan sumber (batch query — hindari N+1)
    const sourceTransactions = await this.transactionRepo
      .createQueryBuilder('trx')
      .where('trx.tenant_id = :tid', { tid })
      .andWhere("trx.type = 'INCOME'")
      .andWhere('trx.is_recurring = true')
      .andWhere('EXTRACT(YEAR FROM trx.transaction_date) = :year', { year: sourceYear })
      .andWhere('EXTRACT(MONTH FROM trx.transaction_date) = :month', { month: sourceMonth })
      .andWhere('trx.deleted_at IS NULL')
      .getMany();

    if (sourceTransactions.length === 0) {
      return { generated: 0, skipped: 0, sourceMonth, sourceYear, items: [] };
    }

    // Ambil transaksi pemasukan rutin yang SUDAH ADA di bulan target (batch query — hindari N+1)
    const existingTransactions = await this.transactionRepo
      .createQueryBuilder('trx')
      .where('trx.tenant_id = :tid', { tid })
      .andWhere("trx.type = 'INCOME'")
      .andWhere('trx.is_recurring = true')
      .andWhere('EXTRACT(YEAR FROM trx.transaction_date) = :year', { year: targetYear })
      .andWhere('EXTRACT(MONTH FROM trx.transaction_date) = :month', { month: targetMonth })
      .andWhere('trx.deleted_at IS NULL')
      .getMany();

    // Key unik untuk identifikasi duplikasi: categoryId-description-amount
    const existingKeys = new Set(
      existingTransactions.map((t) => `${t.categoryId}_${t.description}_${t.amount}`),
    );

    let skipped = 0;
    const savedItems: Transaction[] = [];
    // Jumlah hari di bulan target (untuk sanitasi tanggal akhir bulan)
    const daysInTargetMonth = new Date(targetYear, targetMonth, 0).getDate();

    for (const src of sourceTransactions) {
      const key = `${src.categoryId}_${src.description}_${src.amount}`;
      if (existingKeys.has(key)) {
        skipped++;
        continue;
      }

      // Ambil hari dari tanggal transaksi sumber, clamp ke akhir bulan target jika perlu
      const srcDay = new Date(src.transactionDate).getDate();
      const targetDay = Math.min(srcDay, daysInTargetMonth);
      const targetDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;

      const newTrx = this.transactionRepo.create({
        tenantId: tid,
        type: src.type,
        categoryId: src.categoryId,
        familyMemberId: src.familyMemberId,
        description: src.description,
        amount: src.amount,
        transactionDate: targetDate,
        notes: src.notes,
        isRecurring: true,
        receiptPhoto: undefined, // Foto struk tidak disalin
      });

      const saved = await this.transactionRepo.save(newTrx);
      savedItems.push(saved);
      existingKeys.add(key);
    }

    return { generated: savedItems.length, skipped, sourceMonth, sourceYear, items: savedItems };
  }
}

