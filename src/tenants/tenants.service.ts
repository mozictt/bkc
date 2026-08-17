import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
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
      isMaster: false,
      settings: {},
    });

    return await this.tenantRepo.save(newTenant);
  }

  async findAll(search?: string, page = 1, limit = 20) {
    const query = this.tenantRepo.createQueryBuilder('tenant');

    if (search) {
      query.where('tenant.name ILIKE :search OR tenant.slug ILIKE :search OR tenant.email ILIKE :search', {
        search: `%${search}%`,
      });
    }

    query.orderBy('tenant.isMaster', 'DESC').addOrderBy('tenant.createdAt', 'DESC');

    const total = await query.getCount();
    const items = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      items,
      meta: {
        totalItems: total,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(total / limit),
        currentPage: page,
      },
    };
  }

  async findOne(id: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant dengan ID ${id} tidak ditemukan.`);
    }
    return tenant;
  }

  async updateSettings(id: string, settings: Record<string, any>) {
    const tenant = await this.findOne(id);
    tenant.settings = { ...(tenant.settings || {}), ...settings };
    return await this.tenantRepo.save(tenant);
  }

  async toggleMaster(id: string) {
    const tenant = await this.findOne(id);
    tenant.isMaster = !tenant.isMaster;
    return await this.tenantRepo.save(tenant);
  }
}
