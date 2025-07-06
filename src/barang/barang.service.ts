import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Barang } from '../entities/barang.entity';

@Injectable()
export class BarangService {
  constructor(
    @InjectRepository(Barang)
    private readonly barangRepo: Repository<Barang>,
  ) {}

  //   async findAll(): Promise<Barang[]> {
  //     return this.barangRepo.find();
  //   }
  async findAll(page = 1, limit = 10): Promise<any> {
    const [data, total] = await this.barangRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      success: true,
      currentPage: page,
      totalItems: total,
      totalPages: Math.ceil(total / limit),
      data,
    };
  }

  async findOne(id: number): Promise<Barang> {
    const barang = await this.barangRepo.findOne({ where: { id } });
    if (!barang) throw new NotFoundException('Barang tidak ditemukan');
    return barang;
  }

  async create(data: Partial<Barang>): Promise<Barang> {
    const barang = this.barangRepo.create(data);
    return this.barangRepo.save(barang);
  }

  async update(id: number, data: Partial<Barang>): Promise<Barang> {
    const existing = await this.findOne(id);
    Object.assign(existing, data);
    return this.barangRepo.save(existing);
  }

  async remove(id: number): Promise<void> {
    const existing = await this.findOne(id);
    await this.barangRepo.remove(existing);
  }
}
