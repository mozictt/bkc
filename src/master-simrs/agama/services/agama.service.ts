import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Agama } from '@entities/agama.entity';
import { CreateAgamaDto } from '../dto/create-agama.dto';
import { UpdateAgamaDto } from '../dto/update-agama.dto';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { BaseTenantService } from '@common/tenant/base-tenant.service';

@Injectable()
export class AgamaService extends BaseTenantService<Agama> {
  constructor(
    @InjectRepository(Agama)
    private readonly repo: Repository<Agama>,
    tenantService: TenantContextService,
  ) {
    super(repo, tenantService, 'ag');
  }

  async findAll(
    page = 1,
    limit = 10,
    search = '',
    sortBy = 'id',
    sortType = 'desc',
  ) {
    const safeLimit = Math.max(1, limit);
    const safePage = Math.max(1, page);
    const qb = this.createQuery();

    if (search) {
      qb.andWhere('UPPER(ag.nama) LIKE :s', {
        s: `%${search.toUpperCase()}%`,
      });
    }

    const allowedSort = ['id', 'nama'];
    const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'id';

    const [data, total] = await qb
      .orderBy(`ag.${orderColumn}`, sortType.toUpperCase() as any)
      .skip((safePage - 1) * safeLimit)
      .take(safeLimit)
      .getManyAndCount();

    return {
      success: true,
      currentPage: safePage,
      totalItems: total,
      totalPages: Math.ceil(total / safeLimit),
      array: data,
    };
  }

  async findOne(id: number) {
    return this.findOneById(id);
  }

  async create(dto: CreateAgamaDto) {
    const payload = { ...dto, tenantId: this.tenantId };
    const item = this.repo.create(payload);
    return this.handleSave(item);
  }

  async update(id: number, dto: UpdateAgamaDto) {
    const existing = await this.findOneById(id);
    const updated = Object.assign(existing, dto);
    return this.handleSave(updated);
  }

  async remove(id: number) {
    const existing = await this.findOneById(id);
    try {
      return await this.repo.remove(existing);
    } catch (e) {
      if (e.code === '23503')
        throw new ConflictException(
          'Data tidak bisa dihapus karena masih digunakan',
        );
      throw e;
    }
  }

  private async handleSave(data: any) {
    try {
      return await this.repo.save(data);
    } catch (e) {
      if (e.code === '23505') throw new ConflictException('Nama sudah digunakan');
      throw e;
    }
  }
}

