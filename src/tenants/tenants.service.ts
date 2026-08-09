import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { RegisterTenantDto } from './dto/register-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  async registerTenant(dto: RegisterTenantDto) {
    const existing = await this.tenantRepo.findOne({ where: [{ name: dto.name }, { slug: dto.slug }] });
    if (existing) {
      throw new ConflictException('Tenant dengan nama atau slug tersebut sudah ada.');
    }

    const expiredAt = new Date();
    expiredAt.setDate(expiredAt.getDate() + 14); // Default trial 14 hari

    const newTenant = this.tenantRepo.create({
      name: dto.name,
      slug: dto.slug,
      email: dto.email,
      expiredAt: expiredAt,
      isActive: true,
    });

    return await this.tenantRepo.save(newTenant);
  }
}
