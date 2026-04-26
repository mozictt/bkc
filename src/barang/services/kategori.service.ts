import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KategoriBarang } from '@entities/kategori-barang.entity';
import { CreateKategoriDto } from '../dto/create-kategori.dto';
import { UpdateKategoriDto } from '../dto/update-kategori.dto';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { BaseTenantService } from '../../common/tenant/base-tenant.service';

@Injectable()
export class KategoriService extends BaseTenantService<KategoriBarang> {
  constructor(
    @InjectRepository(KategoriBarang)
    private readonly repo: Repository<KategoriBarang>,
    tenantService: TenantContextService,
  ) {
    // 'k' adalah alias tabel kategori untuk query builder
    super(repo, tenantService, 'k');
  }

  /**
   * Mengambil semua data kategori dengan filter tenantId otomatis
   */
  async findAll(
    page = 1,
    limit = 10,
    search = '',
    sortBy = 'id',
    sortType = 'desc',
  ) {
    const safeLimit = Math.max(1, limit);
    const safePage = Math.max(1, page);

    // createQuery() berasal dari BaseTenantService, sudah include: WHERE k.tenantId = :tenantId
    const qb = this.createQuery();

    if (search) {
      qb.andWhere('UPPER(k.nama) LIKE :s', { s: `%${search.toUpperCase()}%` });
    }

    // Validasi kolom sort agar aman dari SQL Injection
    const allowedSort = ['id', 'nama'];
    const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'id';

    const [data, total] = await qb
      .orderBy(`k.${orderColumn}`, sortType.toUpperCase() as any)
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

  /**
   * Mengambil satu data (Otomatis terfilter tenantId di BaseService)
   */
  async findOne(id: number) {
    return this.findOneById(id);
  }

  /**
   * Membuat kategori baru
   * tenantId akan diisi OTOMATIS oleh TenantSubscriber
   */
  async create(dto: CreateKategoriDto) {
    const kategori = this.repo.create(dto);
    return this.handleSave(kategori);
  }

  /**
   * Mengupdate kategori
   */
  async update(id: number, dto: UpdateKategoriDto) {
    const existing = await this.findOneById(id);
    const updated = Object.assign(existing, dto);
    return this.handleSave(updated);
  }

  /**
   * Menghapus kategori
   */
  async remove(id: number) {
    const existing = await this.findOneById(id);
    try {
      return await this.repo.softRemove(existing);
    } catch (e) {
      // Handling error relasi database (FK Constraint)
      if (e.code === '23503') {
        throw new ConflictException(
          'Kategori tidak bisa dihapus karena masih digunakan oleh data barang',
        );
      }
      throw e;
    }
  }

  /**
   * Wrapper untuk menyimpan data ke DB dengan error handling yang konsisten
   */
  private async handleSave(data: any) {
    try {
      return await this.repo.save(data);
    } catch (e) {
      // Handling error unique constraint (Duplicate Nama)
      if (e.code === '23505') {
        throw new ConflictException('Nama kategori sudah digunakan');
      }
      throw e;
    }
  }
}