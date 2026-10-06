import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FamilyMember } from '../entities/family-member.entity';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { BaseTenantService } from '../../common/tenant/base-tenant.service';
import { CreateFamilyMemberDto, UpdateFamilyMemberDto } from '../dto/family-member.dto';

@Injectable()
export class FamilyMemberService extends BaseTenantService<FamilyMember> {
  constructor(
    @InjectRepository(FamilyMember)
    private readonly memberRepo: Repository<FamilyMember>,
    tenantService: TenantContextService,
  ) {
    super(memberRepo, tenantService, 'fm');
  }

  async findAll() {
    return this.createQuery()
      .andWhere('fm.isActive = :isActive', { isActive: true })
      .orderBy('fm.name', 'ASC')
      .getMany();
  }

  async findOne(id: number): Promise<FamilyMember> {
    const member = await this.createQuery()
      .andWhere('fm.id = :id', { id })
      .getOne();

    if (!member) {
      throw new NotFoundException('Anggota keluarga tidak ditemukan');
    }
    return member;
  }

  async create(dto: CreateFamilyMemberDto): Promise<FamilyMember> {
    const member = this.memberRepo.create({
      ...dto,
      tenantId: this.tenantId,
    });
    return this.memberRepo.save(member);
  }

  async update(id: number, dto: UpdateFamilyMemberDto): Promise<FamilyMember> {
    const member = await this.findOne(id);
    Object.assign(member, dto);
    return this.memberRepo.save(member);
  }

  async remove(id: number): Promise<void> {
    const member = await this.findOne(id);
    try {
      await this.memberRepo.softRemove(member);
    } catch (error) {
      if (error.code === '23503') {
        throw new ConflictException(
          'Anggota keluarga tidak bisa dihapus karena masih terkait dengan transaksi',
        );
      }
      throw error;
    }
  }
}
