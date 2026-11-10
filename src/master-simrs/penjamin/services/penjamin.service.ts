import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Penjamin } from '@entities/penjamin.entity';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { BaseTenantService } from '@common/tenant/base-tenant.service';
import { getPostgresErrorCode } from '@common/utils/postgres-error.util';
import { CreatePenjaminDto } from '../dto/create-penjamin.dto';
import { UpdatePenjaminDto } from '../dto/update-penjamin.dto';
import { QueryPenjaminDto } from '../dto/query-penjamin.dto';

@Injectable()
export class PenjaminService extends BaseTenantService<Penjamin> {
  constructor(
    @InjectRepository(Penjamin)
    private readonly repo: Repository<Penjamin>,
    tenantService: TenantContextService,
  ) {
    super(repo, tenantService, 'penjamin');
  }

  async findAll(queryDto: QueryPenjaminDto) {
    const page = Math.max(1, queryDto.page ?? 1);
    const limit = Math.max(1, Math.min(100, queryDto.limit ?? 10));
    const {
      search,
      jenisPenjamin,
      status,
      sortBy = 'id',
      sortType = 'DESC',
    } = queryDto;

    const qb = this.createQuery();

    if (search && search.trim()) {
      const term = `%${search.trim().toUpperCase()}%`;
      qb.andWhere(
        '(UPPER(penjamin.kode) LIKE :term OR UPPER(penjamin.nama) LIKE :term OR UPPER(penjamin.noPks) LIKE :term)',
        { term },
      );
    }

    if (jenisPenjamin) {
      qb.andWhere('penjamin.jenisPenjamin = :jenisPenjamin', { jenisPenjamin });
    }

    if (status) {
      qb.andWhere('penjamin.status = :status', { status });
    }

    const allowedSort = ['id', 'kode', 'nama', 'jenisPenjamin', 'createdAt'];
    const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'id';
    const orderDirection = sortType === 'ASC' ? 'ASC' : 'DESC';

    const [items, totalItems] = await qb
      .orderBy(`penjamin.${orderColumn}`, orderDirection)
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

  /**
   * Daftar opsi penjamin aktif (tenant aktif + seeder global) untuk dropdown form Pasien.
   */
  async findOptions(search = '') {
    const tenantId = this.tenantId;
    const qb = this.repo
      .createQueryBuilder('penjamin')
      .select([
        'penjamin.id',
        'penjamin.kode',
        'penjamin.nama',
        'penjamin.jenisPenjamin',
        'penjamin.butuhNoKartu',
        'penjamin.status',
      ])
      .where('(penjamin.tenantId = :tenantId OR penjamin.tenantId IS NULL)', {
        tenantId,
      })
      .andWhere('penjamin.status = :status', { status: 'Y' });

    if (search.trim()) {
      const term = `%${search.trim().toUpperCase()}%`;
      qb.andWhere(
        '(UPPER(penjamin.kode) LIKE :term OR UPPER(penjamin.nama) LIKE :term)',
        { term },
      );
    }

    return qb.orderBy('penjamin.nama', 'ASC').getMany();
  }

  async findOne(id: number): Promise<Penjamin> {
    const item = await this.repo.findOne({
      where: { id, tenantId: this.tenantId },
    });
    if (!item) {
      throw new NotFoundException(`Penjamin dengan ID #${id} tidak ditemukan.`);
    }
    return item;
  }

  async create(dto: CreatePenjaminDto): Promise<Penjamin> {
    await this.assertUniqueFields(dto.kode, dto.nama);

    const entity = this.repo.create({
      ...dto,
      tenantId: this.tenantId,
    });
    return this.saveWithConstraintHandling(entity);
  }

  async update(id: number, dto: UpdatePenjaminDto): Promise<Penjamin> {
    const existing = await this.findOne(id);
    await this.assertUniqueFields(
      dto.kode ?? existing.kode,
      dto.nama ?? existing.nama,
      id,
    );

    Object.assign(existing, dto);
    return this.saveWithConstraintHandling(existing);
  }

  async remove(id: number) {
    const existing = await this.findOne(id);
    try {
      await this.repo.softRemove(existing);
      return {
        message: `Data penjamin "${existing.nama}" berhasil dihapus.`,
      };
    } catch (error: unknown) {
      if (getPostgresErrorCode(error) === '23503') {
        throw new ConflictException(
          'Data penjamin tidak dapat dihapus karena masih digunakan oleh data penjamin pasien.',
        );
      }
      throw error;
    }
  }

  private async assertUniqueFields(
    kode: string,
    nama: string,
    excludeId?: number,
  ): Promise<void> {
    const tenantId = this.tenantId;
    const idFilter = excludeId ? { id: Not(excludeId) } : {};

    const [dupKode, dupNama] = await Promise.all([
      this.repo.findOne({
        where: { kode, tenantId, ...idFilter },
        select: ['id'],
      }),
      this.repo.findOne({
        where: { nama, tenantId, ...idFilter },
        select: ['id'],
      }),
    ]);

    if (dupKode) {
      throw new ConflictException(`Kode penjamin "${kode}" sudah digunakan.`);
    }
    if (dupNama) {
      throw new ConflictException(`Nama penjamin "${nama}" sudah digunakan.`);
    }
  }

  private async saveWithConstraintHandling(
    entity: Penjamin,
  ): Promise<Penjamin> {
    try {
      return await this.repo.save(entity);
    } catch (error: unknown) {
      if (getPostgresErrorCode(error) === '23505') {
        throw new ConflictException(
          'Kode atau nama penjamin sudah terdaftar pada tenant ini.',
        );
      }
      throw error;
    }
  }
}
