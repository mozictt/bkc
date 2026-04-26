import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Barang } from '@entities/barang.entity';
import { KategoriBarang } from '@entities/kategori-barang.entity';
import { CreateBulkBarangDto } from '../dto/create-bulk-barang.dto';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { BaseTenantService } from '../../common/tenant/base-tenant.service';
import { tenantInnerJoin } from '../../common/utils/query-utils';

@Injectable()
export class BarangService extends BaseTenantService<Barang> {
  constructor(
    @InjectRepository(Barang)
    private readonly barangRepo: Repository<Barang>,
    tenantService: TenantContextService,
    @InjectRepository(KategoriBarang)
    private readonly kategoriRepo: Repository<KategoriBarang>,
  ) {
    // 'b' adalah alias untuk tabel barang
    super(barangRepo, tenantService, 'b');
  }

  /**
   * Mengambil semua barang (Filter tenantId OTOMATIS dari Base Service)
   */
  async findAll(
    page = 1,
    limit = 10,
    search = '',
    sortBy = 'id',
    sortType = 'desc',
  ) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const tid = this.tenantService.getTenantId();

    // createQuery() sudah mengandung "WHERE b.tenantId = :tenantId"
    const qb = this.createQuery();
    tenantInnerJoin(qb, 'b.kategori', 'kategori', tid);

    if (search) {
      qb.andWhere(
        '(UPPER(b.nama) LIKE :search OR UPPER(b.deskripsi) LIKE :search)',
        { search: `%${search.toUpperCase()}%` },
      );
    }

    const allowedSort = ['id', 'nama', 'harga', 'stok'];
    const orderBy = allowedSort.includes(sortBy) ? sortBy : 'id';

    const [data, total] = await qb
      .orderBy(`b.${orderBy}`, sortType.toUpperCase() as any)
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
   * Mengambil satu barang (Otomatis terfilter tenantId)
   */
  async findOne(id: number) {
    // Kita gunakan createQuery agar bisa include leftJoin
    const barang = await this.createQuery()
      .leftJoinAndSelect('b.kategori', 'kategori')
      .andWhere('b.id = :id', { id })
      .getOne();

    if (!barang) throw new NotFoundException('Barang tidak ditemukan');
    return barang;
  }

  /**
   * Create (tenantId diisi otomatis oleh TenantSubscriber)
   */
  async create(data: Partial<Barang>) {
    const barang = this.barangRepo.create(data);
    return this.barangRepo.save(barang);
  }

  /**
   * Create Bulk (tenantId diisi otomatis oleh TenantSubscriber)
   */
  async createBulk(body: CreateBulkBarangDto) {
    // Validasi kategori harus milik tenant yang sama
    const kategori = await this.kategoriRepo.findOne({
      where: {
        nama: body.kategori,
        tenantId: this.tenantService.getTenantId(), // Ambil dari BaseTenantService
      } as any,
    });

    if (!kategori) throw new NotFoundException('Kategori tidak ditemukan');

    const dataWithKategori = body.data.map((item) => ({
      ...item,
      kategori: kategori,
    }));

    return this.barangRepo.save(dataWithKategori);
  }

  /**
   * Update (Otomatis terfilter tenantId via findOne)
   */
  async update(id: number, data: Partial<Barang>) {
    const existing = await this.findOne(id);
    Object.assign(existing, data);
    return this.barangRepo.save(existing);
  }

  /**
   * Remove (Soft Delete recommended untuk project besar)
   */
  async remove(id: number) {
    const existing = await this.findOne(id);
    try {
      return await this.barangRepo.softRemove(existing);
    } catch (error) {
      if (error.code === '23503') {
        throw new ConflictException(
          'Barang tidak bisa dihapus karena sudah digunakan dalam transaksi',
        );
      }
      throw error;
    }
  }
}
