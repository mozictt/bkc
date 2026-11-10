import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Not, Repository } from 'typeorm';
import { Penduduk } from '@entities/penduduk.entity';
import { Agama } from '@entities/agama.entity';
import { Pendidikan } from '@entities/pendidikan.entity';
import { Pekerjaan } from '@entities/pekerjaan.entity';
import { Suku } from '@entities/suku.entity';
import { Kelurahan } from '@entities/kelurahan.entity';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { BaseTenantService } from '@common/tenant/base-tenant.service';
import { getPostgresErrorCode } from '@common/utils/postgres-error.util';
import { CreatePendudukDto } from '../dto/create-penduduk.dto';
import { UpdatePendudukDto } from '../dto/update-penduduk.dto';
import { QueryPendudukDto } from '../dto/query-penduduk.dto';

@Injectable()
export class PendudukService extends BaseTenantService<Penduduk> {
  constructor(
    @InjectRepository(Penduduk)
    private readonly repo: Repository<Penduduk>,
    private readonly dataSource: DataSource,
    tenantService: TenantContextService,
  ) {
    super(repo, tenantService, 'penduduk');
  }

  async findAll(queryDto: QueryPendudukDto) {
    const page = Math.max(1, queryDto.page ?? 1);
    const limit = Math.max(1, Math.min(100, queryDto.limit ?? 10));
    const {
      search,
      jenisKelamin,
      idKelurahan,
      sortBy = 'id',
      sortType = 'DESC',
    } = queryDto;

    const qb = this.createQuery()
      .leftJoin('penduduk.agama', 'agama')
      .leftJoin('penduduk.pekerjaan', 'pekerjaan')
      .leftJoin('penduduk.kelurahan', 'kelurahan')
      .select([
        'penduduk.id',
        'penduduk.jenisIdentitas',
        'penduduk.nik',
        'penduduk.noIdentitasLain',
        'penduduk.namaLengkap',
        'penduduk.namaIbuKandung',
        'penduduk.tempatLahir',
        'penduduk.tanggalLahir',
        'penduduk.jenisKelamin',
        'penduduk.statusHidup',
        'penduduk.noTelepon',
        'penduduk.alamatKtp',
        'penduduk.idKelurahan',
        'penduduk.createdAt',
        'agama.id',
        'agama.nama',
        'pekerjaan.id',
        'pekerjaan.nama',
        'kelurahan.id',
        'kelurahan.nama',
      ]);

    if (search) {
      qb.andWhere(
        '(UPPER(penduduk.namaLengkap) LIKE :search OR penduduk.nik LIKE :nikSearch OR UPPER(penduduk.noIdentitasLain) LIKE :search)',
        {
          search: `%${search.trim().toUpperCase()}%`,
          nikSearch: `%${search.trim()}%`,
        },
      );
    }

    if (jenisKelamin) {
      qb.andWhere('penduduk.jenisKelamin = :jenisKelamin', { jenisKelamin });
    }

    if (idKelurahan) {
      qb.andWhere('penduduk.idKelurahan = :idKelurahan', { idKelurahan });
    }

    const allowedSort = ['id', 'namaLengkap', 'nik', 'createdAt'];
    const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'id';
    const orderDirection = sortType === 'ASC' ? 'ASC' : 'DESC';

    const [items, totalItems] = await qb
      .orderBy(`penduduk.${orderColumn}`, orderDirection)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items,
      meta: {
        totalItems,
        itemCount: items.length,
        itemsPerPage: limit,
        totalPages: Math.ceil(totalItems / limit) || 1,
        currentPage: page,
      },
    };
  }

  async findOne(id: number): Promise<Penduduk> {
    const penduduk = await this.createQuery()
      .leftJoinAndSelect('penduduk.agama', 'agama')
      .leftJoinAndSelect('penduduk.pendidikan', 'pendidikan')
      .leftJoinAndSelect('penduduk.pekerjaan', 'pekerjaan')
      .leftJoinAndSelect('penduduk.suku', 'suku')
      .leftJoinAndSelect('penduduk.kelurahan', 'kelurahan')
      .leftJoinAndSelect('kelurahan.kecamatan', 'kecamatan')
      .leftJoinAndSelect('kecamatan.kabupaten', 'kabupaten')
      .leftJoinAndSelect('kabupaten.provinsi', 'provinsi')
      .andWhere('penduduk.id = :id', { id })
      .getOne();

    if (!penduduk) {
      throw new NotFoundException(`Penduduk dengan ID #${id} tidak ditemukan.`);
    }

    return penduduk;
  }

  async findByNik(nik: string): Promise<Penduduk> {
    const normalizedNik = nik.trim();
    if (!/^\d{16}$/.test(normalizedNik)) {
      throw new BadRequestException(
        'NIK harus terdiri dari tepat 16 digit angka.',
      );
    }

    const penduduk = await this.createQuery()
      .leftJoinAndSelect('penduduk.agama', 'agama')
      .leftJoinAndSelect('penduduk.pendidikan', 'pendidikan')
      .leftJoinAndSelect('penduduk.pekerjaan', 'pekerjaan')
      .leftJoinAndSelect('penduduk.suku', 'suku')
      .leftJoinAndSelect('penduduk.kelurahan', 'kelurahan')
      .andWhere('penduduk.nik = :nik', { nik: normalizedNik })
      .getOne();

    if (!penduduk) {
      throw new NotFoundException(
        `Penduduk dengan NIK "${normalizedNik}" tidak ditemukan.`,
      );
    }

    return penduduk;
  }

  async create(dto: CreatePendudukDto): Promise<Penduduk> {
    const saved = await this.createInTransaction(
      this.dataSource.manager,
      this.tenantId,
      dto,
    );
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdatePendudukDto): Promise<Penduduk> {
    await this.updateInTransaction(
      this.dataSource.manager,
      this.tenantId,
      id,
      dto,
    );
    return this.findOne(id);
  }

  async remove(id: number) {
    const existing = await this.findOneById(id);
    try {
      await this.repo.remove(existing);
      return {
        message: `Data penduduk "${existing.namaLengkap}" berhasil dihapus.`,
      };
    } catch (error: unknown) {
      if (getPostgresErrorCode(error) === '23503') {
        throw new ConflictException(
          'Data penduduk tidak dapat dihapus karena masih digunakan oleh data pegawai, dokter, atau pasien.',
        );
      }
      throw error;
    }
  }

  /**
   * Helper transaksi yang dapat dipakai ulang oleh modul lain (Dokter, Pegawai, Pasien)
   * untuk membuat record Penduduk secara atomik dalam 1 transaksi DB.
   */
  async createInTransaction(
    manager: EntityManager,
    tenantId: string,
    dto: CreatePendudukDto,
  ): Promise<Penduduk> {
    await this.validatePendudukInput(manager, tenantId, dto);

    const entity = manager.create(Penduduk, {
      ...dto,
      tenantId,
    });

    return this.saveWithConstraintHandling(manager, entity);
  }

  /**
   * Helper transaksi untuk memperbarui record Penduduk secara atomik.
   */
  async updateInTransaction(
    manager: EntityManager,
    tenantId: string,
    id: number,
    dto: UpdatePendudukDto,
  ): Promise<Penduduk> {
    const existing = await manager.findOne(Penduduk, {
      where: { id, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(`Penduduk dengan ID #${id} tidak ditemukan.`);
    }

    await this.validatePendudukInput(manager, tenantId, dto, id, existing);
    Object.assign(existing, dto);

    return this.saveWithConstraintHandling(manager, existing);
  }

  private async validatePendudukInput(
    manager: EntityManager,
    tenantId: string,
    dto: Partial<CreatePendudukDto>,
    excludeId?: number,
    existingPenduduk?: Penduduk,
  ): Promise<void> {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const effectiveBirth =
      dto.tanggalLahir ?? existingPenduduk?.tanggalLahir ?? null;
    const effectiveDeath =
      dto.tanggalMeninggal ?? existingPenduduk?.tanggalMeninggal ?? null;

    if (dto.tanggalLahir) {
      const birthDate = new Date(dto.tanggalLahir);
      if (Number.isNaN(birthDate.getTime()) || birthDate > today) {
        throw new BadRequestException(
          'Tanggal lahir tidak valid atau tidak boleh melebihi tanggal hari ini.',
        );
      }
    }

    if (dto.tanggalMeninggal) {
      const deathDate = new Date(dto.tanggalMeninggal);
      if (Number.isNaN(deathDate.getTime()) || deathDate > today) {
        throw new BadRequestException(
          'Tanggal meninggal tidak valid atau tidak boleh melebihi tanggal hari ini.',
        );
      }
    }

    if (effectiveBirth && effectiveDeath) {
      if (new Date(effectiveDeath) < new Date(effectiveBirth)) {
        throw new BadRequestException(
          'Tanggal meninggal tidak boleh lebih awal dari tanggal lahir.',
        );
      }
    }

    if (dto.nik) {
      const existingNik = await manager.findOne(Penduduk, {
        where: {
          nik: dto.nik,
          tenantId,
          ...(excludeId ? { id: Not(excludeId) } : {}),
        },
        select: ['id', 'nik'],
      });
      if (existingNik) {
        throw new ConflictException(
          `Penduduk dengan NIK "${dto.nik}" sudah terdaftar (ID #${existingNik.id}).`,
        );
      }
    }

    if (dto.noIdentitasLain) {
      const jenisIdentitas =
        dto.jenisIdentitas ?? existingPenduduk?.jenisIdentitas ?? 'KTP';
      const existingAlt = await manager.findOne(Penduduk, {
        where: {
          jenisIdentitas,
          noIdentitasLain: dto.noIdentitasLain,
          tenantId,
          ...(excludeId ? { id: Not(excludeId) } : {}),
        },
        select: ['id'],
      });
      if (existingAlt) {
        throw new ConflictException(
          `Penduduk dengan ${jenisIdentitas} "${dto.noIdentitasLain}" sudah terdaftar.`,
        );
      }
    }

    await this.validateForeignKeys(manager, tenantId, dto);
  }

  private async validateForeignKeys(
    manager: EntityManager,
    tenantId: string,
    dto: Partial<CreatePendudukDto>,
  ): Promise<void> {
    const checks: Promise<void>[] = [];

    if (dto.idKelurahan !== undefined && dto.idKelurahan !== null) {
      checks.push(
        manager
          .findOne(Kelurahan, {
            where: { id: dto.idKelurahan },
            select: ['id'],
          })
          .then((found) => {
            if (!found) {
              throw new BadRequestException(
                `Kelurahan dengan ID "${dto.idKelurahan}" tidak ditemukan.`,
              );
            }
          }),
      );
    }

    checks.push(
      this.assertMasterExists(manager, Agama, dto.agamaId, tenantId, 'Agama'),
      this.assertMasterExists(
        manager,
        Pendidikan,
        dto.pendidikanId,
        tenantId,
        'Pendidikan',
      ),
      this.assertMasterExists(
        manager,
        Pekerjaan,
        dto.pekerjaanId,
        tenantId,
        'Pekerjaan',
      ),
      this.assertMasterExists(manager, Suku, dto.sukuId, tenantId, 'Suku'),
    );

    await Promise.all(checks);
  }

  private async assertMasterExists(
    manager: EntityManager,
    entityClass: new () => { id: number; tenantId: string | null },
    id: number | undefined | null,
    tenantId: string,
    label: string,
  ): Promise<void> {
    if (id === undefined || id === null) return;

    // Mengizinkan master milik tenant aktif maupun master hasil seeder global (tenantId IS NULL)
    const found = await manager.findOne(entityClass, {
      where: [
        { id, tenantId },
        { id, tenantId: IsNull() },
      ],
      select: ['id'],
    });

    if (!found) {
      throw new BadRequestException(
        `Data ${label} dengan ID #${id} tidak ditemukan.`,
      );
    }
  }

  private async saveWithConstraintHandling(
    manager: EntityManager,
    entity: Penduduk,
  ): Promise<Penduduk> {
    try {
      return await manager.save(Penduduk, entity);
    } catch (error: unknown) {
      if (getPostgresErrorCode(error) === '23505') {
        throw new ConflictException(
          'NIK penduduk sudah terdaftar pada fasilitas/tenant ini.',
        );
      }
      throw error;
    }
  }
}
