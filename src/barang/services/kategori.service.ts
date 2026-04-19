import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KategoriBarang } from '@entities/kategori-barang.entity';
import { CreateKategoriDto } from '../dto/create-kategori.dto';
import { UpdateKategoriDto } from '../dto/update-kategori.dto';

@Injectable()
export class KategoriService {
  constructor(
    @InjectRepository(KategoriBarang)
    private readonly kategoriRepo: Repository<KategoriBarang>,
  ) {}

  async findAll(
    page = 1,
    limit = 10,
    search = '',
    sortBy = 'id',
    sortType = 'desc',
  ): Promise<any> {
    // Pastikan page dan limit valid untuk mencegah error OFFSET negatif di DB
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);

    const query = this.kategoriRepo.createQueryBuilder('kategori');

    if (search) {
      query.where('UPPER(kategori.nama) LIKE :search', {
        search: `%${search.toUpperCase()}%`,
      });
    }

    const allowedSort = ['id', 'nama'];
    const orderBy = allowedSort.includes(sortBy) ? sortBy : 'id';
    const orderType = sortType === 'asc' ? 'ASC' : 'DESC';

    query.orderBy(`kategori.${orderBy}`, orderType);

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

  async findOne(id: number): Promise<KategoriBarang> {
    const kategori = await this.kategoriRepo.findOne({
      where: { id }, // Jika ingin melihat daftar barang di kategori tersebut
    });

    if (!kategori) throw new NotFoundException('Kategori tidak ditemukan');
    return kategori;
  }

  async create(data: CreateKategoriDto): Promise<KategoriBarang> {
    try {
      const kategori = this.kategoriRepo.create(data);
      return await this.kategoriRepo.save(kategori);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('Nama kategori sudah digunakan');
      }
      throw error;
    }
  }

  async update(id: number, data: UpdateKategoriDto): Promise<KategoriBarang> {
    const existing = await this.findOne(id);
    Object.assign(existing, data);
    try {
      return await this.kategoriRepo.save(existing);
    } catch (error) {
      if (error.code === '23505') {
        throw new ConflictException('Nama kategori sudah digunakan');
      }
      throw error;
    }
  }

  async remove(id: number): Promise<void> {
    const existing = await this.findOne(id);
    try {
      await this.kategoriRepo.remove(existing);
    } catch (error) {
      if (error.code === '23503') {
        throw new ConflictException(
          'Kategori tidak bisa dihapus karena masih digunakan oleh data barang',
        );
      }
      throw error;
    }
  }
}
