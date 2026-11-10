import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Not, Repository } from 'typeorm';
import { Dokter } from '@entities/dokter.entity';
import { Penduduk } from '@entities/penduduk.entity';
import { Pegawai } from '@entities/pegawai.entity';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { BaseTenantService } from '@common/tenant/base-tenant.service';
import { getPostgresErrorCode } from '@common/utils/postgres-error.util';
import { PegawaiService } from '@src/pegawai/pegawai.service';
import { PendudukService } from '../../penduduk/services/penduduk.service';
import { CreateDokterDto } from '../dto/create-dokter.dto';
import { UpdateDokterDto } from '../dto/update-dokter.dto';
import { QueryDokterDto } from '../dto/query-dokter.dto';

export function formatNamaGelarDokter(
  gelarDepan?: string | null,
  namaLengkap?: string | null,
  gelarBelakang?: string | null,
): string {
  const namaUtama = [gelarDepan?.trim(), namaLengkap?.trim()]
    .filter(Boolean)
    .join(' ');
  if (!namaUtama) return '';
  return gelarBelakang?.trim()
    ? `${namaUtama}, ${gelarBelakang.trim()}`
    : namaUtama;
}

@Injectable()
export class DokterService extends BaseTenantService<Dokter> {
  constructor(
    @InjectRepository(Dokter)
    private readonly repo: Repository<Dokter>,
    @InjectRepository(Pegawai)
    private readonly pegawaiRepo: Repository<Pegawai>,
    @InjectRepository(Penduduk)
    private readonly pendudukRepo: Repository<Penduduk>,
    private readonly dataSource: DataSource,
    private readonly pendudukService: PendudukService,
    private readonly pegawaiService: PegawaiService,
    tenantService: TenantContextService,
  ) {
    super(repo, tenantService, 'dokter');
  }

  async findAll(queryDto: QueryDokterDto) {
    const page = Math.max(1, queryDto.page ?? 1);
    const limit = Math.max(1, Math.min(100, queryDto.limit ?? 10));
    const {
      search,
      jenisDokter,
      spesialisasi,
      status,
      sortBy = 'id',
      sortType = 'DESC',
    } = queryDto;

    const qb = this.createQuery()
      .leftJoin('dokter.penduduk', 'penduduk')
      .leftJoin('dokter.pegawai', 'pegawai')
      .select([
        'dokter.id',
        'dokter.kodeDokter',
        'dokter.pendudukId',
        'dokter.pegawaiId',
        'dokter.gelarDepan',
        'dokter.gelarBelakang',
        'dokter.jenisDokter',
        'dokter.spesialisasi',
        'dokter.noStr',
        'dokter.isStrSeumurHidup',
        'dokter.strBerlakuSampai',
        'dokter.noSip',
        'dokter.sipBerlakuSampai',
        'dokter.ihsPractitionerId',
        'dokter.kodeBpjs',
        'dokter.status',
        'dokter.createdAt',
        'penduduk.id',
        'penduduk.nik',
        'penduduk.namaLengkap',
        'penduduk.jenisKelamin',
        'penduduk.noTelepon',
        'pegawai.id',
        'pegawai.nip',
        'pegawai.statusKepegawaian',
        'pegawai.statusAktif',
        'pegawai.unitKerja',
        'pegawai.avatar',
      ]);

    if (search) {
      const normalized = `%${search.trim().toUpperCase()}%`;
      qb.andWhere(
        '(UPPER(dokter.kodeDokter) LIKE :search OR UPPER(penduduk.namaLengkap) LIKE :search OR UPPER(pegawai.nip) LIKE :search OR UPPER(dokter.noStr) LIKE :search OR UPPER(dokter.noSip) LIKE :search OR UPPER(dokter.spesialisasi) LIKE :search)',
        { search: normalized },
      );
    }

    if (jenisDokter) {
      qb.andWhere('dokter.jenisDokter = :jenisDokter', { jenisDokter });
    }

    if (spesialisasi) {
      qb.andWhere('UPPER(dokter.spesialisasi) LIKE :spesialisasi', {
        spesialisasi: `%${spesialisasi.trim().toUpperCase()}%`,
      });
    }

    if (status) {
      qb.andWhere('dokter.status = :status', { status });
    }

    const allowedSort = [
      'id',
      'kodeDokter',
      'jenisDokter',
      'spesialisasi',
      'createdAt',
    ];
    const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'id';
    const orderDirection = sortType === 'ASC' ? 'ASC' : 'DESC';

    const [rows, totalItems] = await qb
      .orderBy(`dokter.${orderColumn}`, orderDirection)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const items = rows.map((row) => ({
      ...row,
      namaTampilan: formatNamaGelarDokter(
        row.gelarDepan,
        row.penduduk?.namaLengkap,
        row.gelarBelakang,
      ),
    }));

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

  async findOne(id: number) {
    const dokter = await this.createQuery()
      .leftJoinAndSelect('dokter.penduduk', 'penduduk')
      .leftJoinAndSelect('penduduk.agama', 'agama')
      .leftJoinAndSelect('penduduk.pendidikan', 'pendidikan')
      .leftJoinAndSelect('penduduk.pekerjaan', 'pekerjaan')
      .leftJoinAndSelect('penduduk.suku', 'suku')
      .leftJoinAndSelect('penduduk.kelurahan', 'kelurahan')
      .leftJoinAndSelect('kelurahan.kecamatan', 'kecamatan')
      .leftJoinAndSelect('kecamatan.kabupaten', 'kabupaten')
      .leftJoinAndSelect('kabupaten.provinsi', 'provinsi')
      .leftJoinAndSelect('dokter.pegawai', 'pegawai')
      .andWhere('dokter.id = :id', { id })
      .getOne();

    if (!dokter) {
      throw new NotFoundException(`Dokter dengan ID #${id} tidak ditemukan.`);
    }

    return {
      ...dokter,
      namaTampilan: formatNamaGelarDokter(
        dokter.gelarDepan,
        dokter.penduduk?.namaLengkap,
        dokter.gelarBelakang,
      ),
    };
  }

  async findAvailablePegawai(search = '') {
    const tenantId = this.tenantId;
    const qb = this.pegawaiRepo
      .createQueryBuilder('pegawai')
      .leftJoin('pegawai.penduduk', 'penduduk')
      .select([
        'pegawai.id',
        'pegawai.nip',
        'pegawai.name',
        'pegawai.position',
        'pegawai.statusKepegawaian',
        'pegawai.statusAktif',
        'pegawai.pendudukId',
        'penduduk.id',
        'penduduk.nik',
        'penduduk.namaLengkap',
      ])
      .where('pegawai.tenantId = :tenantId', { tenantId });

    if (search.trim()) {
      qb.andWhere(
        '(UPPER(pegawai.nip) LIKE :search OR UPPER(pegawai.name) LIKE :search)',
        { search: `%${search.trim().toUpperCase()}%` },
      );
    }

    qb.andWhere((subQb) => {
      const subQuery = subQb
        .subQuery()
        .select('1')
        .from('dokter', 'd')
        .where('d.pegawai_id = pegawai.id')
        .andWhere('d.deleted_at IS NULL')
        .getQuery();
      return `NOT EXISTS ${subQuery}`;
    });

    return qb.orderBy('pegawai.name', 'ASC').take(50).getMany();
  }

  async findAvailablePenduduk(search = '') {
    const tenantId = this.tenantId;
    const qb = this.pendudukRepo
      .createQueryBuilder('penduduk')
      .select([
        'penduduk.id',
        'penduduk.nik',
        'penduduk.namaLengkap',
        'penduduk.jenisKelamin',
        'penduduk.tanggalLahir',
      ])
      .where('penduduk.tenantId = :tenantId', { tenantId });

    if (search.trim()) {
      qb.andWhere(
        '(UPPER(penduduk.namaLengkap) LIKE :search OR penduduk.nik LIKE :nikSearch)',
        {
          search: `%${search.trim().toUpperCase()}%`,
          nikSearch: `%${search.trim()}%`,
        },
      );
    }

    qb.andWhere((subQb) => {
      const subQuery = subQb
        .subQuery()
        .select('1')
        .from('dokter', 'd')
        .where('d.penduduk_id = penduduk.id')
        .andWhere('d.deleted_at IS NULL')
        .getQuery();
      return `NOT EXISTS ${subQuery}`;
    });

    return qb.orderBy('penduduk.namaLengkap', 'ASC').take(50).getMany();
  }

  async create(dto: CreateDokterDto) {
    this.validateCreateRelationsInput(dto);
    const tenantId = this.tenantId;

    const savedId = await this.dataSource.transaction(async (manager) => {
      const penduduk = await this.resolvePendudukForCreate(
        manager,
        tenantId,
        dto,
      );
      const pegawaiId = await this.resolvePegawaiForCreate(
        manager,
        tenantId,
        penduduk,
        dto,
      );

      await this.validateDokterFields(manager, tenantId, {
        kodeDokter: dto.kodeDokter,
        noStr: dto.noStr,
        pendudukId: penduduk.id,
        pegawaiId,
        isStrSeumurHidup: dto.isStrSeumurHidup,
        strTerbitPada: dto.strTerbitPada,
        strBerlakuSampai: dto.strBerlakuSampai,
        sipTerbitPada: dto.sipTerbitPada,
        sipBerlakuSampai: dto.sipBerlakuSampai,
      });

      const dokterPayload = { ...dto };
      delete dokterPayload.penduduk;
      delete dokterPayload.pegawai;
      const dokter = manager.create(Dokter, {
        ...dokterPayload,
        pendudukId: penduduk.id,
        pegawaiId,
        strBerlakuSampai: dto.isStrSeumurHidup
          ? null
          : (dto.strBerlakuSampai ?? null),
        tenantId,
      });

      const saved = await this.saveWithConstraintHandling(manager, dokter);
      return saved.id;
    });

    return this.findOne(savedId);
  }

  async update(id: number, dto: UpdateDokterDto) {
    const tenantId = this.tenantId;

    await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(Dokter, {
        where: { id, tenantId },
      });
      if (!existing) {
        throw new NotFoundException(`Dokter dengan ID #${id} tidak ditemukan.`);
      }

      const targetPendudukId = dto.pendudukId ?? existing.pendudukId;
      const targetPegawaiId =
        dto.pegawaiId !== undefined ? dto.pegawaiId : existing.pegawaiId;

      if (dto.pendudukId && dto.pendudukId !== existing.pendudukId) {
        const penduduk = await manager.findOne(Penduduk, {
          where: { id: dto.pendudukId, tenantId },
          select: ['id'],
        });
        if (!penduduk) {
          throw new NotFoundException(
            `Penduduk dengan ID #${dto.pendudukId} tidak ditemukan.`,
          );
        }
      }

      if (targetPegawaiId !== null) {
        await this.ensurePegawaiConsistency(
          manager,
          tenantId,
          targetPendudukId,
          targetPegawaiId,
          id,
        );
      }

      const isStrSeumurHidup =
        dto.isStrSeumurHidup ?? existing.isStrSeumurHidup;

      await this.validateDokterFields(
        manager,
        tenantId,
        {
          kodeDokter: dto.kodeDokter ?? existing.kodeDokter,
          noStr: dto.noStr !== undefined ? dto.noStr : existing.noStr,
          pendudukId: targetPendudukId,
          pegawaiId: targetPegawaiId,
          isStrSeumurHidup,
          strTerbitPada:
            dto.strTerbitPada !== undefined
              ? dto.strTerbitPada
              : existing.strTerbitPada,
          strBerlakuSampai: isStrSeumurHidup
            ? null
            : dto.strBerlakuSampai !== undefined
              ? dto.strBerlakuSampai
              : existing.strBerlakuSampai,
          sipTerbitPada:
            dto.sipTerbitPada !== undefined
              ? dto.sipTerbitPada
              : existing.sipTerbitPada,
          sipBerlakuSampai:
            dto.sipBerlakuSampai !== undefined
              ? dto.sipBerlakuSampai
              : existing.sipBerlakuSampai,
        },
        id,
      );

      Object.assign(existing, dto);
      if (isStrSeumurHidup) {
        existing.strBerlakuSampai = null;
      }

      await this.saveWithConstraintHandling(manager, existing);
    });

    return this.findOne(id);
  }

  async remove(id: number) {
    const existing = await this.findOneById(id);
    try {
      await this.repo.softRemove(existing);
      return {
        message: `Data dokter "${existing.kodeDokter}" berhasil dihapus.`,
      };
    } catch (error: unknown) {
      if (getPostgresErrorCode(error) === '23503') {
        throw new ConflictException(
          'Data dokter tidak dapat dihapus karena masih digunakan pada transaksi pelayanan.',
        );
      }
      throw error;
    }
  }

  private validateCreateRelationsInput(dto: CreateDokterDto): void {
    if (dto.pendudukId && dto.penduduk) {
      throw new BadRequestException(
        'Pilih salah satu: gunakan pendudukId atau kirim objek penduduk baru, bukan keduanya.',
      );
    }
    if (!dto.pendudukId && !dto.penduduk) {
      throw new BadRequestException(
        'pendudukId atau objek data penduduk baru wajib diisi.',
      );
    }
    if (dto.pegawaiId && dto.pegawai) {
      throw new BadRequestException(
        'Pilih salah satu: gunakan pegawaiId atau kirim objek pegawai baru, bukan keduanya.',
      );
    }
  }

  private async resolvePendudukForCreate(
    manager: EntityManager,
    tenantId: string,
    dto: CreateDokterDto,
  ): Promise<Penduduk> {
    if (dto.pendudukId) {
      const found = await manager.findOne(Penduduk, {
        where: { id: dto.pendudukId, tenantId },
      });
      if (!found) {
        throw new NotFoundException(
          `Penduduk dengan ID #${dto.pendudukId} tidak ditemukan.`,
        );
      }
      return found;
    }

    const pendudukDto = dto.penduduk!;
    if (!pendudukDto.nik) {
      throw new BadRequestException(
        'NIK (16 digit) wajib diisi saat mendaftarkan data penduduk dokter baru.',
      );
    }

    return this.pendudukService.createInTransaction(
      manager,
      tenantId,
      pendudukDto,
    );
  }

  private async resolvePegawaiForCreate(
    manager: EntityManager,
    tenantId: string,
    penduduk: Penduduk,
    dto: CreateDokterDto,
  ): Promise<number | null> {
    if (dto.pegawaiId) {
      await this.ensurePegawaiConsistency(
        manager,
        tenantId,
        penduduk.id,
        dto.pegawaiId,
      );
      return dto.pegawaiId;
    }

    if (dto.pegawai) {
      const createdPegawai = await this.pegawaiService.createInTransaction(
        manager,
        tenantId,
        {
          ...dto.pegawai,
          pendudukId: penduduk.id,
          name: dto.pegawai.name || penduduk.namaLengkap,
        },
      );
      return createdPegawai.id;
    }

    return null;
  }

  private async ensurePegawaiConsistency(
    manager: EntityManager,
    tenantId: string,
    pendudukId: number,
    pegawaiId: number,
    excludeDokterId?: number,
  ): Promise<void> {
    const pegawai = await manager.findOne(Pegawai, {
      where: { id: pegawaiId, tenantId },
    });
    if (!pegawai) {
      throw new NotFoundException(
        `Pegawai dengan ID #${pegawaiId} tidak ditemukan.`,
      );
    }

    if (pegawai.pendudukId && pegawai.pendudukId !== pendudukId) {
      throw new BadRequestException(
        'Data pegawai yang dipilih sudah terhubung dengan data penduduk yang berbeda.',
      );
    }

    const existingDokterByPegawai = await manager.findOne(Dokter, {
      where: {
        pegawaiId,
        tenantId,
        ...(excludeDokterId ? { id: Not(excludeDokterId) } : {}),
      },
      select: ['id', 'kodeDokter'],
    });
    if (existingDokterByPegawai) {
      throw new ConflictException(
        `Pegawai tersebut sudah terdaftar sebagai dokter (${existingDokterByPegawai.kodeDokter}).`,
      );
    }

    // Jika pegawai belum memiliki tautan penduduk_id, tautkan secara otomatis setelah cek tidak bentrok
    if (!pegawai.pendudukId) {
      const otherPegawaiUsingPenduduk = await manager.findOne(Pegawai, {
        where: {
          pendudukId,
          tenantId,
          id: Not(pegawai.id),
        },
        select: ['id', 'nip'],
      });
      if (otherPegawaiUsingPenduduk) {
        throw new ConflictException(
          `Penduduk sudah terhubung dengan pegawai lain (NIP "${otherPegawaiUsingPenduduk.nip}").`,
        );
      }
      await manager.update(Pegawai, { id: pegawai.id }, { pendudukId });
    }
  }

  private async validateDokterFields(
    manager: EntityManager,
    tenantId: string,
    data: {
      kodeDokter: string;
      noStr?: string | null;
      pendudukId: number;
      pegawaiId: number | null;
      isStrSeumurHidup?: boolean;
      strTerbitPada?: string | null;
      strBerlakuSampai?: string | null;
      sipTerbitPada?: string | null;
      sipBerlakuSampai?: string | null;
    },
    excludeId?: number,
  ): Promise<void> {
    if (
      !data.isStrSeumurHidup &&
      data.strTerbitPada &&
      data.strBerlakuSampai &&
      new Date(data.strBerlakuSampai) < new Date(data.strTerbitPada)
    ) {
      throw new BadRequestException(
        'Tanggal berakhir STR tidak boleh lebih awal dari tanggal terbit STR.',
      );
    }

    if (
      data.sipTerbitPada &&
      data.sipBerlakuSampai &&
      new Date(data.sipBerlakuSampai) < new Date(data.sipTerbitPada)
    ) {
      throw new BadRequestException(
        'Tanggal berakhir SIP tidak boleh lebih awal dari tanggal terbit SIP.',
      );
    }

    const idFilter = excludeId ? { id: Not(excludeId) } : {};

    const [dupKode, dupPenduduk, dupStr] = await Promise.all([
      manager.findOne(Dokter, {
        where: { kodeDokter: data.kodeDokter, tenantId, ...idFilter },
        select: ['id'],
      }),
      manager.findOne(Dokter, {
        where: { pendudukId: data.pendudukId, tenantId, ...idFilter },
        select: ['id', 'kodeDokter'],
      }),
      data.noStr
        ? manager.findOne(Dokter, {
            where: { noStr: data.noStr, tenantId, ...idFilter },
            select: ['id'],
          })
        : Promise.resolve(null),
    ]);

    if (dupKode) {
      throw new ConflictException(
        `Kode dokter "${data.kodeDokter}" sudah terdaftar.`,
      );
    }
    if (dupPenduduk) {
      throw new ConflictException(
        `Penduduk tersebut sudah terdaftar sebagai dokter (${dupPenduduk.kodeDokter}).`,
      );
    }
    if (dupStr) {
      throw new ConflictException(
        `Nomor STR "${data.noStr}" sudah terdaftar pada dokter lain.`,
      );
    }
  }

  private async saveWithConstraintHandling(
    manager: EntityManager,
    dokter: Dokter,
  ): Promise<Dokter> {
    try {
      return await manager.save(Dokter, dokter);
    } catch (error: unknown) {
      if (getPostgresErrorCode(error) === '23505') {
        throw new ConflictException(
          'Kode dokter, nomor STR, penduduk, atau pegawai sudah terdaftar pada tenant ini.',
        );
      }
      throw error;
    }
  }
}
