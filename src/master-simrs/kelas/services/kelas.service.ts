import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Kelas } from '@entities/kelas.entity';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { BaseTenantService } from '@common/tenant/base-tenant.service';
import {
  assertUniqueTenantFields,
  removeWithFkHandling,
  saveWithUniqueHandling,
} from '../../helpers/master-entity.helper';
import { CreateKelasDto } from '../dto/create-kelas.dto';
import { UpdateKelasDto } from '../dto/update-kelas.dto';
import { QueryKelasDto } from '../dto/query-kelas.dto';

@Injectable()
export class KelasService extends BaseTenantService<Kelas> {
  constructor(
    @InjectRepository(Kelas)
    private readonly repo: Repository<Kelas>,
    tenantService: TenantContextService,
  ) {
    super(repo, tenantService, 'kelas');
  }

  async findAll(queryDto: QueryKelasDto) {
    const page = Math.max(1, queryDto.page ?? 1);
    const limit = Math.max(1, Math.min(100, queryDto.limit ?? 10));
    const { search, status, sortBy = 'urutan', sortType = 'ASC' } = queryDto;

    const qb = this.createQuery();

    if (search && search.trim()) {
      const term = `%${search.trim().toUpperCase()}%`;
      qb.andWhere(
        '(UPPER(kelas.kode) LIKE :term OR UPPER(kelas.nama) LIKE :term OR UPPER(kelas.kodeBpjsAplicare) LIKE :term)',
        { term },
      );
    }

    if (status) {
      qb.andWhere('kelas.status = :status', { status });
    }

    const allowedSort = ['id', 'kode', 'nama', 'urutan', 'createdAt'];
    const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'urutan';
    const orderDirection = sortType === 'DESC' ? 'DESC' : 'ASC';

    const [items, totalItems] = await qb
      .orderBy(`kelas.${orderColumn}`, orderDirection)
      .addOrderBy('kelas.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      meta: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(totalItems / limit) || 1,
        currentPage: page,
      },
    };
  }

  async findOptions(search = '') {
    const qb = this.repo
      .createQueryBuilder('kelas')
      .select([
        'kelas.id',
        'kelas.kode',
        'kelas.nama',
        'kelas.urutan',
        'kelas.kodeBpjsAplicare',
        'kelas.tarifAkomodasi',
      ])
      .where('(kelas.tenantId = :tenantId OR kelas.tenantId IS NULL)', {
        tenantId: this.tenantId,
      })
      .andWhere('kelas.status = :status', { status: 'Y' });

    if (search.trim()) {
      const term = `%${search.trim().toUpperCase()}%`;
      qb.andWhere(
        '(UPPER(kelas.kode) LIKE :term OR UPPER(kelas.nama) LIKE :term)',
        { term },
      );
    }

    return qb
      .orderBy('kelas.urutan', 'ASC')
      .addOrderBy('kelas.nama', 'ASC')
      .getMany();
  }

  async findOne(id: number): Promise<Kelas> {
    const item = await this.repo.findOne({
      where: { id, tenantId: this.tenantId },
    });
    if (!item) {
      throw new NotFoundException(`Kelas dengan ID #${id} tidak ditemukan.`);
    }
    return item;
  }

  async create(dto: CreateKelasDto): Promise<Kelas> {
    await assertUniqueTenantFields(this.repo, this.tenantId, [
      { field: 'kode', value: dto.kode, label: 'Kode kelas' },
      { field: 'nama', value: dto.nama, label: 'Nama kelas' },
    ]);

    const entity = this.repo.create({
      ...dto,
      tarifAkomodasi:
        dto.tarifAkomodasi !== undefined ? dto.tarifAkomodasi.toFixed(2) : null,
      tenantId: this.tenantId,
    });

    return saveWithUniqueHandling(
      this.repo,
      entity,
      'Kode atau nama kelas sudah terdaftar pada tenant ini.',
    );
  }

  async update(id: number, dto: UpdateKelasDto): Promise<Kelas> {
    const existing = await this.findOne(id);
    await assertUniqueTenantFields(
      this.repo,
      this.tenantId,
      [
        {
          field: 'kode',
          value: dto.kode ?? existing.kode,
          label: 'Kode kelas',
        },
        {
          field: 'nama',
          value: dto.nama ?? existing.nama,
          label: 'Nama kelas',
        },
      ],
      id,
    );

    const { tarifAkomodasi, ...rest } = dto;
    Object.assign(existing, rest);
    if (tarifAkomodasi !== undefined) {
      existing.tarifAkomodasi = tarifAkomodasi.toFixed(2);
    }

    return saveWithUniqueHandling(
      this.repo,
      existing,
      'Kode atau nama kelas sudah terdaftar pada tenant ini.',
    );
  }

  async remove(id: number) {
    const existing = await this.findOne(id);
    await removeWithFkHandling(
      this.repo,
      existing,
      'Data kelas tidak dapat dihapus karena masih digunakan oleh data unit, bed, atau penjamin pasien.',
    );
    return {
      message: `Data kelas "${existing.nama}" berhasil dihapus.`,
    };
  }
}
