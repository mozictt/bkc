// src/common/base/base-tenant.service.ts
import { Repository, SelectQueryBuilder, ObjectLiteral } from 'typeorm';
import { TenantContextService } from '../tenant/tenant-context.service';
import { NotFoundException } from '@nestjs/common';

export abstract class BaseTenantService<T extends ObjectLiteral> {
  constructor(
    protected readonly repository: Repository<T>,
    protected readonly tenantService: TenantContextService,
    protected readonly alias: string,
  ) {}

  protected get tenantId(): string {
    const id = this.tenantService.getTenantId();
    if (!id) throw new Error('Tenant Context not found!');
    return id;
  }

  /**
   * Filter Otomatis untuk QueryBuilder (Selalu Terisolasi Per Tenant Context)
   */
  protected createQuery(): SelectQueryBuilder<T> {
    const qb = this.repository.createQueryBuilder(this.alias);
    qb.where(`${this.alias}.tenantId = :tenantId`, { 
      tenantId: this.tenantId
    });
    return qb;
  }

  /**
   * Fungsi FIND ALL Standar (Otomatis)
   */
  async findAllBase(
    page: number, 
    limit: number, 
    searchField?: string, 
    searchValue?: string,
    sortField = 'id',
    sortOrder: 'ASC' | 'DESC' = 'DESC'
  ) {
    const qb = this.createQuery();

    if (searchField && searchValue) {
      qb.andWhere(`UPPER(${this.alias}.${searchField}) LIKE :s`, { 
        s: `%${searchValue.toUpperCase()}%` 
      });
    }

    const [data, total] = await qb
      .orderBy(`${this.alias}.${sortField}`, sortOrder)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: data,
      meta: {
        totalItems: total,
        itemCount: data.length,
        itemsPerPage: +limit,
        totalPages: Math.ceil(total / limit),
        currentPage: +page,
      },
    };
  }

  async findOneById(id: any): Promise<T> {
    const whereClause: any = { 
      id,
      tenantId: this.tenantId
    }; 

    const data = await this.repository.findOneBy(whereClause);
    
    if (!data) throw new NotFoundException(`${this.alias} tidak ditemukan`);
    return data;
  }
}