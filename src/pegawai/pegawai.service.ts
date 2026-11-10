import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';
import { Pegawai } from '../entities/pegawai.entity';
import { User } from '../entities/user.entity';
import { Penduduk } from '../entities/penduduk.entity';
import { Dokter } from '../entities/dokter.entity';
import { Kelurahan } from '../entities/kelurahan.entity';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { getPostgresErrorCode } from '../common/utils/postgres-error.util';
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
    @InjectRepository(Dokter)
    private readonly dokterRepo: Repository<Dokter>,
    private readonly dataSource: DataSource,
    private readonly tenantContext: TenantContextService,
  ) {}

  private requireTenantId(): string {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new BadRequestException('Tenant context tidak ditemukan.');
    }
    return tenantId;
  }

  async create(dto: CreatePegawaiDto) {
    const tenantId = this.requireTenantId();
    const saved = await this.createInTransaction(
      this.dataSource.manager,
      tenantId,
      dto,
    );
    return this.findOne(saved.id);
  }

  async findAll(queryDto: QueryPegawaiDto) {
    const {
      page = 1,
      limit = 10,
      search,
      position,
      statusKepegawaian,
      statusAktif,
      unitKerja,
      sortBy = 'createdAt',
      sortType = 'DESC',
    } = queryDto;
    const tenantId = this.requireTenantId();

    const query = this.pegawaiRepo
      .createQueryBuilder('pegawai')
      .leftJoin('pegawai.penduduk', 'penduduk')
      .leftJoinAndSelect('pegawai.kelurahan', 'kelurahan')
      .leftJoinAndSelect('kelurahan.kecamatan', 'kecamatan')
      .leftJoinAndSelect('kecamatan.kabupaten', 'kabupaten')
      .leftJoinAndSelect('kabupaten.provinsi', 'provinsi')
      .addSelect([
        'penduduk.id',
        'penduduk.nik',
        'penduduk.namaLengkap',
        'penduduk.jenisKelamin',
      ])
      .where('pegawai.tenantId = :tenantId', { tenantId });

    if (search) {
      query.andWhere(
        '(LOWER(pegawai.nip) LIKE :search OR LOWER(pegawai.name) LIKE :search OR LOWER(penduduk.namaLengkap) LIKE :search)',
        { search: `%${search.trim().toLowerCase()}%` },
      );
    }

    if (position) {
      query.andWhere('LOWER(pegawai.position) = :position', {
        position: position.trim().toLowerCase(),
      });
    }

    if (statusKepegawaian) {
      query.andWhere('pegawai.statusKepegawaian = :statusKepegawaian', {
        statusKepegawaian,
      });
    }

    if (statusAktif) {
      query.andWhere('pegawai.statusAktif = :statusAktif', { statusAktif });
    }

    if (unitKerja) {
      query.andWhere('LOWER(pegawai.unitKerja) LIKE :unitKerja', {
        unitKerja: `%${unitKerja.trim().toLowerCase()}%`,
      });
    }

    const allowedSortFields = [
      'createdAt',
      'nip',
      'name',
      'position',
      'statusKepegawaian',
      'statusAktif',
    ];
    const orderField = allowedSortFields.includes(sortBy)
      ? `pegawai.${sortBy}`
      : 'pegawai.createdAt';
    query.orderBy(orderField, sortType === 'ASC' ? 'ASC' : 'DESC');

    const [items, totalItems] = await query
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      success: true,
      currentPage: page,
      totalItems,
      totalPages: Math.ceil(totalItems / limit) || 1,
      array: items,
    };
  }

  async findOne(id: number) {
    const tenantId = this.requireTenantId();
    const pegawai = await this.pegawaiRepo.findOne({
      where: { id, tenantId },
      relations: [
        'penduduk',
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
    const tenantId = this.requireTenantId();
    const query = this.pegawaiRepo
      .createQueryBuilder('pegawai')
      .where('pegawai.tenantId = :tenantId', { tenantId });

    // Subquery untuk memfilter pegawai yang BELUM memiliki akun user aktif
    query.andWhere((qb) => {
      const subQuery = qb
        .subQuery()
        .select('1')
        .from('users', 'user')
        .where('user.pegawai_id = pegawai.id')
        .andWhere('user.deleted_at IS NULL')
        .getQuery();
      return 'NOT EXISTS ' + subQuery;
    });

    return query.orderBy('pegawai.name', 'ASC').getMany();
  }

  async update(id: number, dto: UpdatePegawaiDto) {
    const tenantId = this.requireTenantId();
    const pegawai = await this.findOne(id);

    const validatedPenduduk = await this.validatePegawaiInput(
      this.dataSource.manager,
      tenantId,
      dto,
      id,
      pegawai,
    );

    Object.assign(pegawai, dto);
    if (validatedPenduduk && dto.name === undefined) {
      pegawai.name = validatedPenduduk.namaLengkap;
    }

    await this.saveWithConstraintHandling(this.dataSource.manager, pegawai);
    return this.findOne(id);
  }

  async remove(id: number) {
    const pegawai = await this.findOne(id);
    const tenantId = this.requireTenantId();

    const [hasUser, hasDokter] = await Promise.all([
      this.userRepo.findOne({
        where: { pegawaiId: id, tenantId },
        select: ['id'],
      }),
      this.dokterRepo.findOne({
        where: { pegawaiId: id, tenantId },
        select: ['id'],
      }),
    ]);

    if (hasUser) {
      throw new BadRequestException(
        'Pegawai tidak dapat dihapus karena telah terhubung dengan akun pengguna aktif.',
      );
    }

    if (hasDokter) {
      throw new ConflictException(
        'Pegawai tidak dapat dihapus karena masih terdaftar pada data master dokter.',
      );
    }

    await this.pegawaiRepo.softRemove(pegawai);
    return {
      success: true,
      message: `Pegawai dengan NIP ${pegawai.nip} (${pegawai.name}) berhasil dihapus.`,
    };
  }

  /**
   * Helper transaksi yang dapat dipakai ulang oleh DokterService saat onboarding dokter + pegawai baru.
   */
  async createInTransaction(
    manager: EntityManager,
    tenantId: string,
    dto: CreatePegawaiDto,
  ): Promise<Pegawai> {
    const penduduk = await this.validatePegawaiInput(manager, tenantId, dto);

    const pegawai = manager.create(Pegawai, {
      ...dto,
      name: dto.name || penduduk?.namaLengkap,
      email: dto.email ?? penduduk?.email ?? null,
      phoneNumber: dto.phoneNumber ?? penduduk?.noTelepon ?? null,
      address: dto.address ?? penduduk?.alamatKtp ?? null,
      idKelurahan: dto.idKelurahan ?? penduduk?.idKelurahan ?? null,
      tenantId,
    });

    return this.saveWithConstraintHandling(manager, pegawai);
  }

  private async validatePegawaiInput(
    manager: EntityManager,
    tenantId: string,
    dto: Partial<CreatePegawaiDto>,
    excludeId?: number,
    existingPegawai?: Pegawai,
  ): Promise<Penduduk | null> {
    const tglMasuk = dto.tanggalMasuk ?? existingPegawai?.tanggalMasuk ?? null;
    const tglKeluar =
      dto.tanggalKeluar ?? existingPegawai?.tanggalKeluar ?? null;
    if (tglMasuk && tglKeluar && new Date(tglKeluar) < new Date(tglMasuk)) {
      throw new BadRequestException(
        'Tanggal keluar pegawai tidak boleh lebih awal dari tanggal masuk.',
      );
    }

    if (dto.nip && dto.nip !== existingPegawai?.nip) {
      const existingNip = await manager.findOne(Pegawai, {
        where: {
          nip: dto.nip,
          tenantId,
          ...(excludeId ? { id: Not(excludeId) } : {}),
        },
        select: ['id'],
      });
      if (existingNip) {
        throw new ConflictException(
          `Pegawai dengan NIP "${dto.nip}" sudah terdaftar.`,
        );
      }
    }

    if (dto.email && dto.email !== existingPegawai?.email) {
      const existingEmail = await manager.findOne(Pegawai, {
        where: {
          email: dto.email,
          tenantId,
          ...(excludeId ? { id: Not(excludeId) } : {}),
        },
        select: ['id'],
      });
      if (existingEmail) {
        throw new ConflictException(
          `Pegawai dengan Email "${dto.email}" sudah terdaftar.`,
        );
      }
    }

    if (dto.idKelurahan) {
      const kelurahan = await manager.findOne(Kelurahan, {
        where: { id: dto.idKelurahan },
        select: ['id'],
      });
      if (!kelurahan) {
        throw new BadRequestException(
          `Kelurahan dengan ID "${dto.idKelurahan}" tidak ditemukan.`,
        );
      }
    }

    if (dto.pendudukId !== undefined && dto.pendudukId !== null) {
      const penduduk = await manager.findOne(Penduduk, {
        where: { id: dto.pendudukId, tenantId },
      });
      if (!penduduk) {
        throw new NotFoundException(
          `Penduduk dengan ID #${dto.pendudukId} tidak ditemukan.`,
        );
      }

      const boundPegawai = await manager.findOne(Pegawai, {
        where: {
          pendudukId: dto.pendudukId,
          tenantId,
          ...(excludeId ? { id: Not(excludeId) } : {}),
        },
        select: ['id', 'nip'],
      });
      if (boundPegawai) {
        throw new ConflictException(
          `Penduduk tersebut sudah terhubung dengan Pegawai NIP "${boundPegawai.nip}".`,
        );
      }
      return penduduk;
    }

    return null;
  }

  private async saveWithConstraintHandling(
    manager: EntityManager,
    pegawai: Pegawai,
  ): Promise<Pegawai> {
    try {
      return await manager.save(Pegawai, pegawai);
    } catch (error: unknown) {
      if (getPostgresErrorCode(error) === '23505') {
        throw new ConflictException(
          'NIP, Email, atau Penduduk sudah digunakan oleh pegawai lain pada tenant ini.',
        );
      }
      throw error;
    }
  }
}
