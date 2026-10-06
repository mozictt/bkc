import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExpenseCategory } from '../entities/expense-category.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { BaseTenantService } from '../../common/tenant/base-tenant.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CategoryType } from '../constants/category-type.enum';

@Injectable()
export class CategoryService extends BaseTenantService<ExpenseCategory> {
  constructor(
    @InjectRepository(ExpenseCategory)
    private readonly categoryRepo: Repository<ExpenseCategory>,
    tenantService: TenantContextService,
  ) {
    super(categoryRepo, tenantService, 'cat');
  }

  /**
   * Mengambil semua kategori, diurutkan berdasarkan tipe dan order_no.
   * Opsional: filter berdasarkan tipe (PENGELUARAN/PEMASUKAN).
   */
  async findAll(type?: CategoryType) {
    const qb = this.createQuery();

    if (type) {
      qb.andWhere('cat.type = :type', { type });
    }

    qb.andWhere('cat.isActive = :isActive', { isActive: true })
      .orderBy('cat.type', 'ASC')
      .addOrderBy('cat.orderNo', 'ASC')
      .addOrderBy('cat.name', 'ASC');

    return qb.getMany();
  }

  /**
   * Mengambil semua kategori termasuk yang nonaktif (untuk halaman admin).
   */
  async findAllAdmin(type?: CategoryType) {
    const qb = this.createQuery();

    if (type) {
      qb.andWhere('cat.type = :type', { type });
    }

    qb.orderBy('cat.type', 'ASC')
      .addOrderBy('cat.orderNo', 'ASC')
      .addOrderBy('cat.name', 'ASC');

    return qb.getMany();
  }

  async findOne(id: number): Promise<ExpenseCategory> {
    const category = await this.createQuery()
      .andWhere('cat.id = :id', { id })
      .getOne();

    if (!category) {
      throw new NotFoundException('Kategori tidak ditemukan');
    }
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<ExpenseCategory> {
    const category = this.categoryRepo.create({
      ...dto,
      tenantId: this.tenantId,
    });
    return this.categoryRepo.save(category);
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<ExpenseCategory> {
    const category = await this.findOne(id);
    Object.assign(category, dto);
    return this.categoryRepo.save(category);
  }

  async remove(id: number): Promise<void> {
    const category = await this.findOne(id);
    try {
      await this.categoryRepo.softRemove(category);
    } catch (error) {
      if (error.code === '23503') {
        throw new ConflictException(
          'Kategori tidak bisa dihapus karena masih digunakan oleh transaksi',
        );
      }
      throw error;
    }
  }
}
