// src/company/company.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Company } from '../entities/company.entity';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

@Injectable()
export class CompanyService {
  constructor(
    @InjectRepository(Company)
    private companyRepo: Repository<Company>,
  ) {}

  async getProfile(): Promise<Company> {
    const company = await this.companyRepo.findOne({ where: { id: 1 } });

    if (!company) {
      throw new NotFoundException('Data perusahaan tidak ditemukan');
    }

    return company;
  }

  async updateProfile(id: number, data: Partial<Company>): Promise<Company> {
    const existing = await this.companyRepo.findOne({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Perusahaan dengan ID ${id} tidak ditemukan`);
    }

    await this.companyRepo.update(id, data);

    const updated = await this.companyRepo.findOne({ where: { id } });
    if (!updated) {
      throw new NotFoundException(
        `Data perusahaan gagal dimuat setelah update`,
      );
    }

    return updated;
  }
}
