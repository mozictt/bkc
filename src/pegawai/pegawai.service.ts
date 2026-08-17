import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pegawai } from '../entities/pegawai.entity';
import { User } from '../entities/user.entity';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { CreatePegawaiDto } from './dto/create-pegawai.dto';
import { UpdatePegawaiDto } from './dto/update-pegawai.dto';
import { QueryPegawaiDto } from './dto/query-pegawai.dto';

@Injectable()
export class PegawaiService {
  constructor(
    @InjectRepository(Pegawai)
    private readonly pegawaiRepo: Repository<Pegawai>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly tenantContext: TenantContextService,
  ) {}

  private getTenantFilter() {
    return { tenantId: this.tenantContext.getTenantId() };
  }

  async create(dto: CreatePegawaiDto) {
    const tenantId = this.tenantContext.getTenantId();

    // Cek duplikasi NIP pada tenant yang sama
    const existingNip = await this.pegawaiRepo.findOne({
      where: { nip: dto.nip, tenantId: tenantId ? tenantId : undefined },
    });
    if (existingNip) {
      throw new ConflictException(`Pegawai dengan NIP "${dto.nip}" sudah terdaftar.`);
    }

    // Cek duplikasi Email pada tenant yang sama jika email diisi
    if (dto.email) {
      const existingEmail = await this.pegawaiRepo.findOne({
        where: { email: dto.email, tenantId: tenantId ? tenantId : undefined },
      });
      if (existingEmail) {
        throw new ConflictException(`Pegawai dengan Email "${dto.email}" sudah terdaftar.`);
      }
    }

    const pegawai = this.pegawaiRepo.create({
      ...dto,
      tenantId,
    });

    return this.pegawaiRepo.save(pegawai);
  }

  async findAll(queryDto: QueryPegawaiDto) {
    const { page = 1, limit = 10, search, position, sortBy = 'createdAt', sortType = 'DESC' } = queryDto;
    const tenantId = this.tenantContext.getTenantId();

    const query = this.pegawaiRepo.createQueryBuilder('pegawai')
      .leftJoinAndSelect('pegawai.kelurahan', 'kelurahan')
      .leftJoinAndSelect('kelurahan.kecamatan', 'kecamatan')
      .leftJoinAndSelect('kecamatan.kabupaten', 'kabupaten')
      .leftJoinAndSelect('kabupaten.provinsi', 'provinsi');

    // Filter tenant otomatis
    if (tenantId) {
      query.andWhere('pegawai.tenantId = :tenantId', { tenantId });
    }

    // Pencarian berdasarkan NIP atau Nama
    if (search) {
      query.andWhere(
        '(LOWER(pegawai.nip) LIKE :search OR LOWER(pegawai.name) LIKE :search)',
        { search: `%${search.toLowerCase()}%` },
      );
    }

    // Filter berdasarkan jabatan
    if (position) {
      query.andWhere('LOWER(pegawai.position) = :position', {
        position: position.toLowerCase(),
      });
    }

    // Sorting yang aman
    const allowedSortFields = ['createdAt', 'nip', 'name', 'position'];
    const orderField = allowedSortFields.includes(sortBy) ? `pegawai.${sortBy}` : 'pegawai.createdAt';
    query.orderBy(orderField, sortType);

    const [items, totalItems] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      success: true,
      currentPage: page,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
      array: items,
    };
  }

  async findOne(id: number) {
    const filter = this.getTenantFilter();
    const pegawai = await this.pegawaiRepo.findOne({
      where: { id, ...filter },
      relations: [
        'kelurahan',
        'kelurahan.kecamatan',
        'kelurahan.kecamatan.kabupaten',
        'kelurahan.kecamatan.kabupaten.provinsi',
      ],
    });

    if (!pegawai) {
      throw new NotFoundException(`Pegawai dengan ID #${id} tidak ditemukan.`);
    }

    return pegawai;
  }

  async findUnassigned() {
    const tenantId = this.tenantContext.getTenantId();
    const query = this.pegawaiRepo.createQueryBuilder('pegawai');

    if (tenantId) {
      query.andWhere('pegawai.tenantId = :tenantId', { tenantId });
    }

    // Subquery untuk memfilter pegawai yang BELUM memiliki akun user
    query.andWhere((qb) => {
      const subQuery = qb
        .subQuery()
        .select('1')
        .from('users', 'user')
        .where('user.pegawai_id = pegawai.id')
        .getQuery();
      return 'NOT EXISTS ' + subQuery;
    });

    return query.orderBy('pegawai.name', 'ASC').getMany();
  }

  async update(id: number, dto: UpdatePegawaiDto) {
    const pegawai = await this.findOne(id);
    const tenantId = this.tenantContext.getTenantId();

    // Validasi NIP jika diubah
    if (dto.nip && dto.nip !== pegawai.nip) {
      const existingNip = await this.pegawaiRepo.findOne({
        where: { nip: dto.nip, tenantId: tenantId ? tenantId : undefined },
      });
      if (existingNip && existingNip.id !== id) {
        throw new ConflictException(`Pegawai dengan NIP "${dto.nip}" sudah terdaftar.`);
      }
    }

    // Validasi Email jika diubah
    if (dto.email && dto.email !== pegawai.email) {
      const existingEmail = await this.pegawaiRepo.findOne({
        where: { email: dto.email, tenantId: tenantId ? tenantId : undefined },
      });
      if (existingEmail && existingEmail.id !== id) {
        throw new ConflictException(`Pegawai dengan Email "${dto.email}" sudah terdaftar.`);
      }
    }

    Object.assign(pegawai, dto);
    return this.pegawaiRepo.save(pegawai);
  }

  async remove(id: number) {
    const pegawai = await this.findOne(id);

    // RESTRICT: Cek apakah pegawai ini sudah dikaitkan dengan akun user
    const hasUser = await this.userRepo.findOne({
      where: { pegawaiId: id },
    });
    if (hasUser) {
      throw new BadRequestException(
        'Pegawai tidak dapat dihapus karena telah terhubung dengan akun pengguna aktif.',
      );
    }

    await this.pegawaiRepo.softRemove(pegawai);
    return {
      success: true,
      message: `Pegawai dengan NIP ${pegawai.nip} (${pegawai.name}) berhasil dihapus.`,
    };
  }
}
