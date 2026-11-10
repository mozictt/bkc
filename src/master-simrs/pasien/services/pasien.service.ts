import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  EntityManager,
  In,
  IsNull,
  Not,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import { Pasien } from '@entities/pasien.entity';
import { PasienPenjamin } from '@entities/pasien-penjamin.entity';
import { Penjamin } from '@entities/penjamin.entity';
import { Kelas } from '@entities/kelas.entity';
import { Penduduk } from '@entities/penduduk.entity';
import { Kelurahan } from '@entities/kelurahan.entity';
import { Tenant } from '@entities/tenant.entity';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { BaseTenantService } from '@common/tenant/base-tenant.service';
import { getPostgresErrorCode } from '@common/utils/postgres-error.util';
import { PendudukService } from '../../penduduk/services/penduduk.service';
import { FormatNoRm } from '../../constants/simrs.enum';
import { CreatePasienDto } from '../dto/create-pasien.dto';
import { UpdatePasienDto } from '../dto/update-pasien.dto';
import { QueryPasienDto } from '../dto/query-pasien.dto';
import {
  CreatePasienPenjaminItemDto,
  UpdatePasienPenjaminItemDto,
} from '../dto/pasien-penjamin.dto';

export function formatNoRmSequence(seq: number, format: FormatNoRm): string {
  if (format === FormatNoRm.DASH_6) {
    const raw = String(seq).padStart(6, '0');
    const evenPadded = raw.length % 2 === 1 ? `0${raw}` : raw;
    return evenPadded.replace(/(\d{2})(?=\d)/g, '$1-');
  }
  return String(seq).padStart(8, '0');
}

@Injectable()
export class PasienService extends BaseTenantService<Pasien> {
  constructor(
    @InjectRepository(Pasien)
    private readonly repo: Repository<Pasien>,
    @InjectRepository(PasienPenjamin)
    private readonly penjaminRepo: Repository<PasienPenjamin>,
    private readonly dataSource: DataSource,
    private readonly pendudukService: PendudukService,
    tenantService: TenantContextService,
  ) {
    super(repo, tenantService, 'pasien');
  }

  async findAll(queryDto: QueryPasienDto) {
    const page = Math.max(1, queryDto.page ?? 1);
    const limit = Math.max(1, Math.min(100, queryDto.limit ?? 10));
    const {
      search,
      penjaminId,
      jenisPenjamin,
      kelasHakId,
      isBayiBaruLahir,
      status,
      sortBy = 'id',
      sortType = 'DESC',
    } = queryDto;

    const qb = this.createQuery()
      .leftJoin('pasien.penduduk', 'penduduk')
      .select([
        'pasien.id',
        'pasien.noRm',
        'pasien.pendudukId',
        'pasien.pendudukIbuId',
        'pasien.isBayiBaruLahir',
        'pasien.isIdentitasTidakDiketahui',
        'pasien.alamatSamaKtp',
        'pasien.alamatDomisili',
        'pasien.namaPj',
        'pasien.hubunganPj',
        'pasien.noHpPj',
        'pasien.status',
        'pasien.createdAt',
        'penduduk.id',
        'penduduk.jenisIdentitas',
        'penduduk.nik',
        'penduduk.noIdentitasLain',
        'penduduk.namaLengkap',
        'penduduk.namaIbuKandung',
        'penduduk.tempatLahir',
        'penduduk.tanggalLahir',
        'penduduk.jenisKelamin',
        'penduduk.golonganDarah',
        'penduduk.statusHidup',
        'penduduk.noTelepon',
        'penduduk.alamatKtp',
      ]);

    if (search && search.trim()) {
      const term = search.trim();
      const upperTerm = `%${term.toUpperCase()}%`;
      const exactLikeTerm = `%${term}%`;
      qb.andWhere(
        `(UPPER(pasien.noRm) LIKE :upperTerm OR UPPER(penduduk.namaLengkap) LIKE :upperTerm OR penduduk.nik LIKE :exactLikeTerm OR UPPER(penduduk.noIdentitasLain) LIKE :upperTerm OR EXISTS (SELECT 1 FROM pasien_penjamin pp WHERE pp.pasien_id = pasien.id AND pp.deleted_at IS NULL AND UPPER(pp.no_kartu) LIKE :upperTerm))`,
        { upperTerm, exactLikeTerm },
      );
    }

    if (penjaminId) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM pasien_penjamin pp_id WHERE pp_id.pasien_id = pasien.id AND pp_id.deleted_at IS NULL AND pp_id.penjamin_id = :penjaminId)',
        { penjaminId },
      );
    }

    if (jenisPenjamin) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM pasien_penjamin ppf INNER JOIN penjamin pj ON pj.id = ppf.penjamin_id WHERE ppf.pasien_id = pasien.id AND ppf.deleted_at IS NULL AND pj.deleted_at IS NULL AND pj.jenis_penjamin = :jenisPenjamin)',
        { jenisPenjamin },
      );
    }

    if (kelasHakId) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM pasien_penjamin ppk WHERE ppk.pasien_id = pasien.id AND ppk.deleted_at IS NULL AND ppk.kelas_hak_id = :kelasHakId)',
        { kelasHakId },
      );
    }

    if (isBayiBaruLahir !== undefined) {
      qb.andWhere('pasien.isBayiBaruLahir = :isBayiBaruLahir', {
        isBayiBaruLahir,
      });
    }

    if (status) {
      qb.andWhere('pasien.status = :status', { status });
    }

    const allowedSort = ['id', 'noRm', 'createdAt'];
    const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'id';
    const orderDirection = sortType === 'ASC' ? 'ASC' : 'DESC';

    const [rows, totalItems] = await qb
      .orderBy(`pasien.${orderColumn}`, orderDirection)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const items = await this.attachPenjaminToRows(rows);

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

  async lookup(q = '') {
    const term = q.trim();
    const qb = this.createQuery()
      .leftJoin('pasien.penduduk', 'penduduk')
      .select([
        'pasien.id',
        'pasien.noRm',
        'pasien.pendudukId',
        'pasien.isBayiBaruLahir',
        'pasien.isIdentitasTidakDiketahui',
        'pasien.status',
        'penduduk.id',
        'penduduk.jenisIdentitas',
        'penduduk.nik',
        'penduduk.noIdentitasLain',
        'penduduk.namaLengkap',
        'penduduk.tanggalLahir',
        'penduduk.jenisKelamin',
        'penduduk.noTelepon',
        'penduduk.statusHidup',
      ]);

    if (term) {
      const upperTerm = `%${term.toUpperCase()}%`;
      const exactLikeTerm = `%${term}%`;
      qb.andWhere(
        `(UPPER(pasien.noRm) LIKE :upperTerm OR UPPER(penduduk.namaLengkap) LIKE :upperTerm OR penduduk.nik LIKE :exactLikeTerm OR UPPER(penduduk.noIdentitasLain) LIKE :upperTerm OR EXISTS (SELECT 1 FROM pasien_penjamin pp WHERE pp.pasien_id = pasien.id AND pp.deleted_at IS NULL AND UPPER(pp.no_kartu) LIKE :upperTerm))`,
        { upperTerm, exactLikeTerm },
      );
    }

    const rows = await qb.orderBy('pasien.id', 'DESC').take(20).getMany();

    return this.attachPenjaminToRows(rows);
  }

  async findOne(id: number) {
    return this.findDetailBy(
      'pasien.id = :id',
      { id },
      `Pasien dengan ID #${id} tidak ditemukan.`,
    );
  }

  async findByNoRm(noRm: string) {
    const normalized = noRm.trim();
    return this.findDetailBy(
      'pasien.noRm = :noRm',
      { noRm: normalized },
      `Pasien dengan No. RM "${normalized}" tidak ditemukan.`,
    );
  }

  async create(dto: CreatePasienDto) {
    this.validateCreateRelationsInput(dto);
    const tenantId = this.tenantId;

    const savedId = await this.dataSource.transaction(async (manager) => {
      const penduduk = await this.resolvePendudukForCreate(
        manager,
        tenantId,
        dto,
      );

      await this.validatePasienBusinessRules(manager, tenantId, {
        pendudukId: penduduk.id,
        pendudukIbuId: dto.pendudukIbuId,
        idKelurahanDomisili: dto.idKelurahanDomisili,
        noRm: dto.noRm,
      });

      const noRm = dto.noRm
        ? dto.noRm
        : await this.generateNoRmInTransaction(
            manager,
            tenantId,
            dto.formatNoRm,
          );

      const {
        penduduk: pendudukPayload,
        formatNoRm: formatChoice,
        penjaminList,
        ...pasienFields
      } = dto;
      void pendudukPayload;
      void formatChoice;

      const pasien = manager.create(Pasien, {
        ...pasienFields,
        noRm,
        pendudukId: penduduk.id,
        tenantId,
      });

      const savedPasien = await this.savePasienWithConstraintHandling(
        manager,
        pasien,
      );

      if (penjaminList && penjaminList.length > 0) {
        const kelasIds = penjaminList
          .map((item) => item.kelasHakId)
          .filter((id): id is number => id !== undefined && id !== null);

        const [penjaminMap] = await Promise.all([
          this.resolveAndValidateMasterMap(
            manager,
            Penjamin,
            tenantId,
            penjaminList.map((item) => item.penjaminId),
            'Master Penjamin',
          ),
          kelasIds.length > 0
            ? this.resolveAndValidateMasterMap(
                manager,
                Kelas,
                tenantId,
                kelasIds,
                'Master Kelas',
              )
            : Promise.resolve(new Map<number, Kelas>()),
        ]);

        const penjaminEntities = this.buildPenjaminEntities(
          manager,
          savedPasien.id,
          tenantId,
          penjaminList,
          penjaminMap,
        );
        await this.savePenjaminWithConstraintHandling(
          manager,
          penjaminEntities,
        );
      }

      return savedPasien.id;
    });

    return this.findOne(savedId);
  }

  async update(id: number, dto: UpdatePasienDto) {
    const tenantId = this.tenantId;

    await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(Pasien, {
        where: { id, tenantId },
      });
      if (!existing) {
        throw new NotFoundException(`Pasien dengan ID #${id} tidak ditemukan.`);
      }

      const targetPendudukId = dto.pendudukId ?? existing.pendudukId;
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

      await this.validatePasienBusinessRules(
        manager,
        tenantId,
        {
          pendudukId: targetPendudukId,
          pendudukIbuId:
            dto.pendudukIbuId !== undefined
              ? dto.pendudukIbuId
              : existing.pendudukIbuId,
          idKelurahanDomisili:
            dto.idKelurahanDomisili !== undefined
              ? dto.idKelurahanDomisili
              : existing.idKelurahanDomisili,
          noRm: dto.noRm !== undefined ? dto.noRm : existing.noRm,
        },
        id,
      );

      Object.assign(existing, dto);
      await this.savePasienWithConstraintHandling(manager, existing);
    });

    return this.findOne(id);
  }

  async remove(id: number) {
    const existing = await this.findOneById(id);
    try {
      await this.repo.remove(existing);
      return {
        message: `Data pasien dengan No. RM "${existing.noRm}" berhasil dihapus.`,
      };
    } catch (error: unknown) {
      if (getPostgresErrorCode(error) === '23503') {
        throw new ConflictException(
          'Data pasien tidak dapat dihapus karena masih terhubung dengan rekam medis atau transaksi kunjungan.',
        );
      }
      throw error;
    }
  }

  async listPenjamin(pasienId: number) {
    await this.findOneById(pasienId);
    return this.penjaminRepo.find({
      where: { pasienId, tenantId: this.tenantId },
      relations: ['penjamin', 'kelasHak'],
      order: { isUtama: 'DESC', id: 'ASC' },
    });
  }

  async addPenjamin(pasienId: number, dto: CreatePasienPenjaminItemDto) {
    const tenantId = this.tenantId;
    await this.findOneById(pasienId);

    const savedId = await this.dataSource.transaction(async (manager) => {
      const [penjaminMap] = await Promise.all([
        this.resolveAndValidateMasterMap(
          manager,
          Penjamin,
          tenantId,
          [dto.penjaminId],
          'Master Penjamin',
        ),
        dto.kelasHakId !== undefined && dto.kelasHakId !== null
          ? this.resolveAndValidateMasterMap(
              manager,
              Kelas,
              tenantId,
              [dto.kelasHakId],
              'Master Kelas',
            )
          : Promise.resolve(new Map<number, Kelas>()),
      ]);
      const masterPenjamin = penjaminMap.get(dto.penjaminId)!;
      this.assertPenjaminCardRequirement(masterPenjamin, dto.noKartu);

      await this.assertNoDuplicatePenjaminCard(
        manager,
        tenantId,
        pasienId,
        dto.penjaminId,
        dto.noKartu,
      );

      if (dto.isUtama) {
        await manager.update(
          PasienPenjamin,
          { pasienId, tenantId, isUtama: true },
          { isUtama: false },
        );
      }

      const entity = manager.create(PasienPenjamin, {
        ...dto,
        pasienId,
        tenantId,
      });

      const saved = await this.savePenjaminWithConstraintHandling(manager, [
        entity,
      ]);
      return saved[0].id;
    });

    return this.penjaminRepo.findOne({
      where: { id: savedId, tenantId },
      relations: ['penjamin', 'kelasHak'],
    });
  }

  async updatePenjamin(
    pasienId: number,
    penjaminId: number,
    dto: UpdatePasienPenjaminItemDto,
  ) {
    const tenantId = this.tenantId;
    await this.findOneById(pasienId);

    await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(PasienPenjamin, {
        where: { id: penjaminId, pasienId, tenantId },
      });
      if (!existing) {
        throw new NotFoundException(
          `Penjamin pasien dengan ID #${penjaminId} tidak ditemukan.`,
        );
      }

      const nextPenjaminMasterId = dto.penjaminId ?? existing.penjaminId;
      const nextNoKartu =
        dto.noKartu !== undefined ? dto.noKartu : existing.noKartu;

      const [penjaminMap] = await Promise.all([
        this.resolveAndValidateMasterMap(
          manager,
          Penjamin,
          tenantId,
          [nextPenjaminMasterId],
          'Master Penjamin',
        ),
        dto.kelasHakId !== undefined && dto.kelasHakId !== null
          ? this.resolveAndValidateMasterMap(
              manager,
              Kelas,
              tenantId,
              [dto.kelasHakId],
              'Master Kelas',
            )
          : Promise.resolve(new Map<number, Kelas>()),
      ]);
      const masterPenjamin = penjaminMap.get(nextPenjaminMasterId)!;
      this.assertPenjaminCardRequirement(masterPenjamin, nextNoKartu);

      await this.assertNoDuplicatePenjaminCard(
        manager,
        tenantId,
        pasienId,
        nextPenjaminMasterId,
        nextNoKartu,
        penjaminId,
      );

      if (dto.isUtama === true && !existing.isUtama) {
        await manager.update(
          PasienPenjamin,
          { pasienId, tenantId, isUtama: true, id: Not(penjaminId) },
          { isUtama: false },
        );
      }

      Object.assign(existing, dto);
      await this.savePenjaminWithConstraintHandling(manager, [existing]);
    });

    return this.penjaminRepo.findOne({
      where: { id: penjaminId, pasienId, tenantId },
      relations: ['penjamin', 'kelasHak'],
    });
  }

  async removePenjamin(pasienId: number, penjaminId: number) {
    const tenantId = this.tenantId;
    await this.findOneById(pasienId);

    const existing = await this.penjaminRepo.findOne({
      where: { id: penjaminId, pasienId, tenantId },
      relations: ['penjamin'],
    });
    if (!existing) {
      throw new NotFoundException(
        `Penjamin pasien dengan ID #${penjaminId} tidak ditemukan.`,
      );
    }

    await this.penjaminRepo.softRemove(existing);
    return {
      message: `Penjamin "${existing.penjamin?.nama ?? penjaminId}" berhasil dihapus.`,
    };
  }

  /**
   * Generate No. RM atomik per tenant dengan UPSERT counter PostgreSQL (anti race condition).
   */
  async generateNoRmInTransaction(
    manager: EntityManager,
    tenantId: string,
    requestedFormat?: FormatNoRm,
  ): Promise<string> {
    let format = requestedFormat;
    if (!format) {
      const tenant = await manager.findOne(Tenant, {
        where: { id: tenantId },
        select: ['id', 'settings'],
      });
      const settings = tenant?.settings as Record<string, unknown> | undefined;
      const configured = settings?.noRmFormat;
      format =
        configured === FormatNoRm.DASH_6
          ? FormatNoRm.DASH_6
          : FormatNoRm.PLAIN_8;
    }

    for (let attempt = 0; attempt < 50; attempt += 1) {
      const rawRows: unknown = await manager.query(
        `INSERT INTO tenant_counters (tenant_id, counter_key, last_value, created_at, updated_at)
         VALUES ($1, $2, 1, NOW(), NOW())
         ON CONFLICT (tenant_id, counter_key)
         DO UPDATE SET last_value = tenant_counters.last_value + 1, updated_at = NOW()
         RETURNING last_value`,
        [tenantId, 'NO_RM'],
      );
      const rows = rawRows as Array<{ last_value: string | number }>;

      const seq = Number(rows[0].last_value);
      const candidate = formatNoRmSequence(seq, format);
      const collision = await manager.findOne(Pasien, {
        where: { noRm: candidate, tenantId },
        select: ['id'],
      });
      if (!collision) {
        return candidate;
      }
    }

    throw new ConflictException(
      'Gagal menghasilkan Nomor RM unik setelah beberapa percobaan.',
    );
  }

  private async findDetailBy(
    whereClause: string,
    params: Record<string, unknown>,
    notFoundMessage: string,
  ) {
    const pasien = await this.createQuery()
      .leftJoinAndSelect('pasien.penduduk', 'penduduk')
      .leftJoinAndSelect('penduduk.agama', 'agama')
      .leftJoinAndSelect('penduduk.pendidikan', 'pendidikan')
      .leftJoinAndSelect('penduduk.pekerjaan', 'pekerjaan')
      .leftJoinAndSelect('penduduk.suku', 'suku')
      .leftJoinAndSelect('penduduk.kelurahan', 'kelurahan')
      .leftJoinAndSelect('kelurahan.kecamatan', 'kecamatan')
      .leftJoinAndSelect('kecamatan.kabupaten', 'kabupaten')
      .leftJoinAndSelect('kabupaten.provinsi', 'provinsi')
      .leftJoinAndSelect('pasien.pendudukIbu', 'pendudukIbu')
      .leftJoinAndSelect('pasien.kelurahanDomisili', 'kelurahanDomisili')
      .leftJoinAndSelect('kelurahanDomisili.kecamatan', 'kecamatanDomisili')
      .leftJoinAndSelect('kecamatanDomisili.kabupaten', 'kabupatenDomisili')
      .leftJoinAndSelect('kabupatenDomisili.provinsi', 'provinsiDomisili')
      .leftJoinAndSelect('pasien.penjaminList', 'penjaminList')
      .leftJoinAndSelect('penjaminList.penjamin', 'penjaminMaster')
      .leftJoinAndSelect('penjaminList.kelasHak', 'kelasHakMaster')
      .andWhere(whereClause, params)
      .orderBy('penjaminList.isUtama', 'DESC')
      .addOrderBy('penjaminList.id', 'ASC')
      .getOne();

    if (!pasien) {
      throw new NotFoundException(notFoundMessage);
    }

    const penjaminUtama =
      pasien.penjaminList?.find((p) => p.isUtama) ??
      pasien.penjaminList?.[0] ??
      null;

    return {
      ...pasien,
      penjaminUtama,
    };
  }

  private async attachPenjaminToRows(rows: Pasien[]) {
    if (rows.length === 0) return [];

    const pasienIds = rows.map((row) => row.id);
    const penjaminRows = await this.penjaminRepo.find({
      where: {
        pasienId: In(pasienIds),
        tenantId: this.tenantId,
      },
      relations: ['penjamin', 'kelasHak'],
      order: { isUtama: 'DESC', id: 'ASC' },
    });

    const penjaminMap = new Map<number, PasienPenjamin[]>();
    for (const pj of penjaminRows) {
      const list = penjaminMap.get(pj.pasienId) ?? [];
      list.push(pj);
      penjaminMap.set(pj.pasienId, list);
    }

    return rows.map((row) => {
      const list = penjaminMap.get(row.id) ?? [];
      const penjaminUtama = list.find((p) => p.isUtama) ?? list[0] ?? null;
      return {
        ...row,
        penjaminList: list,
        penjaminUtama,
      };
    });
  }

  private validateCreateRelationsInput(dto: CreatePasienDto): void {
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
  }

  private async resolvePendudukForCreate(
    manager: EntityManager,
    tenantId: string,
    dto: CreatePasienDto,
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

    return this.pendudukService.createInTransaction(
      manager,
      tenantId,
      dto.penduduk!,
    );
  }

  private async validatePasienBusinessRules(
    manager: EntityManager,
    tenantId: string,
    data: {
      pendudukId: number;
      pendudukIbuId?: number | null;
      idKelurahanDomisili?: string | null;
      noRm?: string;
    },
    excludeId?: number,
  ): Promise<void> {
    const idFilter = excludeId ? { id: Not(excludeId) } : {};

    const checks: Promise<void>[] = [
      manager
        .findOne(Pasien, {
          where: { pendudukId: data.pendudukId, tenantId, ...idFilter },
          select: ['id', 'noRm'],
        })
        .then((dupPenduduk) => {
          if (dupPenduduk) {
            throw new ConflictException(
              `Penduduk tersebut sudah terdaftar sebagai pasien (No. RM "${dupPenduduk.noRm}").`,
            );
          }
        }),
    ];

    if (data.noRm) {
      checks.push(
        manager
          .findOne(Pasien, {
            where: { noRm: data.noRm, tenantId, ...idFilter },
            select: ['id'],
          })
          .then((dupRm) => {
            if (dupRm) {
              throw new ConflictException(
                `Nomor Rekam Medis "${data.noRm}" sudah terdaftar.`,
              );
            }
          }),
      );
    }

    if (data.pendudukIbuId) {
      if (data.pendudukIbuId === data.pendudukId) {
        throw new BadRequestException(
          'pendudukIbuId tidak boleh sama dengan penduduk pasien sendiri.',
        );
      }
      checks.push(
        manager
          .findOne(Penduduk, {
            where: { id: data.pendudukIbuId, tenantId },
            select: ['id'],
          })
          .then((ibu) => {
            if (!ibu) {
              throw new BadRequestException(
                `Penduduk ibu dengan ID #${data.pendudukIbuId} tidak ditemukan.`,
              );
            }
          }),
      );
    }

    if (data.idKelurahanDomisili) {
      checks.push(
        manager
          .findOne(Kelurahan, {
            where: { id: data.idKelurahanDomisili },
            select: ['id'],
          })
          .then((kel) => {
            if (!kel) {
              throw new BadRequestException(
                `Kelurahan domisili dengan ID "${data.idKelurahanDomisili}" tidak ditemukan.`,
              );
            }
          }),
      );
    }

    await Promise.all(checks);
  }

  /**
   * Batch lookup master entity (Penjamin, Kelas) agar validasi banyak item tetap 1 query tanpa N+1.
   */
  private async resolveAndValidateMasterMap<
    T extends ObjectLiteral & {
      id: number;
      nama: string;
      status: string;
      tenantId: string | null;
    },
  >(
    manager: EntityManager,
    entityClass: new () => T,
    tenantId: string,
    ids: number[],
    label: string,
  ): Promise<Map<number, T>> {
    const uniqueIds = Array.from(new Set(ids));
    const foundRows = await manager.find(entityClass, {
      where: [
        { id: In(uniqueIds), tenantId },
        { id: In(uniqueIds), tenantId: IsNull() },
      ] as never,
    });

    const masterMap = new Map<number, T>();
    for (const row of foundRows) {
      masterMap.set(row.id, row);
    }

    for (const id of uniqueIds) {
      const master = masterMap.get(id);
      if (!master) {
        throw new BadRequestException(
          `${label} dengan ID #${id} tidak ditemukan.`,
        );
      }
      if (master.status !== 'Y') {
        throw new BadRequestException(
          `${label} "${master.nama}" sedang nonaktif.`,
        );
      }
    }

    return masterMap;
  }

  private assertPenjaminCardRequirement(
    masterPenjamin: Penjamin,
    noKartu?: string | null,
  ): void {
    if (masterPenjamin.butuhNoKartu && !noKartu?.trim()) {
      throw new BadRequestException(
        `Penjamin "${masterPenjamin.nama}" wajib menyertakan nomor kartu / polis.`,
      );
    }
  }

  private buildPenjaminEntities(
    manager: EntityManager,
    pasienId: number,
    tenantId: string,
    items: CreatePasienPenjaminItemDto[],
    penjaminMap: Map<number, Penjamin>,
  ): PasienPenjamin[] {
    const primaryCount = items.filter((item) => item.isUtama === true).length;
    if (primaryCount > 1) {
      throw new BadRequestException(
        'Hanya boleh ada 1 penjamin utama (isUtama = true) untuk satu pasien.',
      );
    }

    const seenCards = new Set<string>();
    const shouldAutoMarkFirst = primaryCount === 0 && items.length > 0;

    return items.map((item, idx) => {
      const master = penjaminMap.get(item.penjaminId)!;
      this.assertPenjaminCardRequirement(master, item.noKartu);

      if (item.noKartu) {
        const cardKey = `${item.penjaminId}::${item.noKartu.toUpperCase()}`;
        if (seenCards.has(cardKey)) {
          throw new BadRequestException(
            `Nomor kartu "${item.noKartu}" untuk penjamin "${master.nama}" terduplikasi dalam payload.`,
          );
        }
        seenCards.add(cardKey);
      }

      return manager.create(PasienPenjamin, {
        ...item,
        isUtama: shouldAutoMarkFirst ? idx === 0 : Boolean(item.isUtama),
        pasienId,
        tenantId,
      });
    });
  }

  private async assertNoDuplicatePenjaminCard(
    manager: EntityManager,
    tenantId: string,
    pasienId: number,
    penjaminId: number,
    noKartu?: string | null,
    excludePenjaminId?: number,
  ): Promise<void> {
    if (!noKartu) return;

    const dup = await manager.findOne(PasienPenjamin, {
      where: {
        tenantId,
        pasienId,
        penjaminId,
        noKartu,
        ...(excludePenjaminId ? { id: Not(excludePenjaminId) } : {}),
      },
      select: ['id'],
    });
    if (dup) {
      throw new ConflictException(
        `Nomor kartu "${noKartu}" untuk penjamin tersebut sudah terdaftar pada pasien ini.`,
      );
    }
  }

  private async savePasienWithConstraintHandling(
    manager: EntityManager,
    pasien: Pasien,
  ): Promise<Pasien> {
    try {
      return await manager.save(Pasien, pasien);
    } catch (error: unknown) {
      if (getPostgresErrorCode(error) === '23505') {
        throw new ConflictException(
          'Nomor RM atau data penduduk pasien sudah terdaftar pada tenant ini.',
        );
      }
      throw error;
    }
  }

  private async savePenjaminWithConstraintHandling(
    manager: EntityManager,
    entities: PasienPenjamin[],
  ): Promise<PasienPenjamin[]> {
    try {
      return await manager.save(PasienPenjamin, entities);
    } catch (error: unknown) {
      if (getPostgresErrorCode(error) === '23505') {
        throw new ConflictException(
          'Nomor kartu penjamin terduplikasi atau sudah terdapat penjamin utama aktif untuk pasien ini.',
        );
      }
      throw error;
    }
  }
}
