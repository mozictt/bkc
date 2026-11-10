import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pekerjaan } from '@entities/pekerjaan.entity';
import { CreatePekerjaanDto } from '../dto/create-pekerjaan.dto';
import { UpdatePekerjaanDto } from '../dto/update-pekerjaan.dto';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { BaseTenantService } from '@common/tenant/base-tenant.service';

@Injectable()
export class PekerjaanService extends BaseTenantService<Pekerjaan> {
  constructor(
    @InjectRepository(Pekerjaan)
    private readonly repo: Repository<Pekerjaan>,
    tenantService: TenantContextService,
  ) {
    super(repo, tenantService, 'p');
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
      qb.andWhere('UPPER(p.nama) LIKE :s', {
        s: `%${search.toUpperCase()}%`,
      });
    }

    const allowedSort = ['id', 'nama'];
    const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'id';

    const [data, total] = await qb
      .orderBy(`p.${orderColumn}`, sortType.toUpperCase() as any)
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

  async create(dto: CreatePekerjaanDto) {
    const payload = { ...dto, tenantId: this.tenantId };
    const item = this.repo.create(payload);
    return this.handleSave(item);
  }

  async update(id: number, dto: UpdatePekerjaanDto) {
    const existing = await this.findOneById(id);
    const updated = Object.assign(existing, dto);
    return this.handleSave(updated);
  }

  async remove(id: number) {
    const existing = await this.findOneById(id);
    try {
      return await this.repo.softRemove(existing);
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

