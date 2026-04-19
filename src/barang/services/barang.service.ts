import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Barang } from '@entities/barang.entity';
// import { KategoriBarang } from '@entities/kategori-barang.entity';
import { KategoriBarang } from '@entities/kategori-barang.entity';
import { CreateBulkBarangDto } from '../dto/create-bulk-barang.dto';

@Injectable()
export class BarangService {
  constructor(
    @InjectRepository(Barang)
    private readonly barangRepo: Repository<Barang>,
    @InjectRepository(KategoriBarang) // ✅ TAMBAHKAN INI
    private readonly kategoriRepo: Repository<KategoriBarang>,
  ) {}

  //   async findAll(): Promise<Barang[]> {
  //     return this.barangRepo.find();
  //   }
  // async findAll(page = 1, limit = 10): Promise<any> {
  //   const [data, total] = await this.barangRepo.findAndCount({
  //     skip: (page - 1) * limit,
  //     take: limit,
  //   });

  //   return {
  //     success: true,
  //     currentPage: page,
  //     totalItems: total,
  //     totalPages: Math.ceil(total / limit),
  //     array:data,
  //   };
  // }
  async findAll(
    page = 1,
    limit = 10,
    search = '',
    sortBy = 'id',
    sortType = 'desc',
  ): Promise<any> {
    // Proteksi pagination agar tidak negatif
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);

    const query = this.barangRepo.createQueryBuilder('barang')
      .leftJoinAndSelect('barang.kategori', 'kategori');
    /* =========================
     SEARCH
  ========================= */
    if (search) {
      query.where(
        'UPPER(barang.nama) LIKE :search OR UPPER(barang.deskripsi) LIKE :search',
        {
          search: `%${search.toUpperCase()}%`,
        },
      );
    }

    /* =========================
     SORTING (WAJIB WHITELIST)
  ========================= */
    const allowedSort = ['id', 'nama', 'harga', 'stok'];

    const orderBy = allowedSort.includes(sortBy) ? sortBy : 'id';
    const orderType = sortType === 'asc' ? 'ASC' : 'DESC';

    query.orderBy(`barang.${orderBy}`, orderType);
    // console.log(query.getSql());

    /* =========================
     PAGINATION
  ========================= */
    const [data, total] = await query
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

  async findOne(id: number): Promise<Barang> {
    const barang = await this.barangRepo.createQueryBuilder('barang')
      .leftJoinAndSelect('barang.kategori', 'kategori')
      .where('barang.id = :id', { id })
      .getOne();

    if (!barang) throw new NotFoundException('Barang tidak ditemukan');
    return barang;
  }

  async create(data: Partial<Barang>): Promise<Barang> {
    const barang = this.barangRepo.create(data);
    return this.barangRepo.save(barang);
  }

  // async createBulk(data: Partial<Barang>[]): Promise<any> {
  //   const result = await this.barangRepo.insert(data);

  //   return {
  //     success: true,
  //     inserted: result.identifiers.length,
  //     ids: result.identifiers,
  //   };
  // }
  async createBulk(body: CreateBulkBarangDto) {
    // 1️⃣ Cek kategori dulu
    const kategori = await this.kategoriRepo.findOne({
      where: { nama: body.kategori },
    });

    if (!kategori) {
      throw new NotFoundException('Kategori tidak ditemukan');
    }

    // 2️⃣ Mapping data + inject id kategori
    const dataWithKategori = body.data.map((item) => ({
      ...item,
      kategori: kategori, // otomatis isi id_kategori_barang
    }));

    // 3️⃣ Insert
    return this.barangRepo.save(dataWithKategori);
  }

  async update(id: number, data: Partial<Barang>): Promise<Barang> {
    const existing = await this.findOne(id);
    Object.assign(existing, data);
    return this.barangRepo.save(existing);
  }

  async remove(id: number): Promise<void> {
    const existing = await this.findOne(id);
    try {
      await this.barangRepo.remove(existing);
    } catch (error) { 
      if (error.code === '23503') {
        throw new ConflictException(
          'Barang tidak bisa dihapus karena sudah memiliki riwayat transaksi atau referensi data lain',
        );
      }
      // Throw error asli jika itu error database lainnya
      throw error;
    }
  }
}
