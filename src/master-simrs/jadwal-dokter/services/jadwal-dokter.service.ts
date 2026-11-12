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
  Repository,
  SelectQueryBuilder,
} from 'typeorm';
import { JadwalDokter } from '@entities/jadwal-dokter.entity';
import { Dokter } from '@entities/dokter.entity';
import { Unit } from '@entities/unit.entity';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { BaseTenantService } from '@common/tenant/base-tenant.service';
import { getPostgresErrorCode } from '@common/utils/postgres-error.util';
import {
  HariPraktik,
  SesiPraktik,
  StatusAktifMaster,
} from '../../constants/simrs.enum';
import { removeWithFkHandling } from '../../helpers/master-entity.helper';
import {
  HARI_PRAKTIK_METADATA,
  HARI_PRAKTIK_ORDER,
  enrichJadwalDokterItem,
  getHariUrutan,
  resolveAndValidateJadwalMetrics,
  resolveHariDariTanggal,
} from '../helpers/jadwal-dokter.helper';
import {
  BulkCreateJadwalDokterDto,
  CreateJadwalDokterDto,
  UpdateStatusJadwalDokterDto,
} from '../dto/create-jadwal-dokter.dto';
import { UpdateJadwalDokterDto } from '../dto/update-jadwal-dokter.dto';
import {
  QueryJadwalDokterDto,
  QueryMingguanJadwalDokterDto,
  QueryOptionsJadwalDokterDto,
} from '../dto/query-jadwal-dokter.dto';

interface JadwalFilterCriteria {
  search?: string;
  dokterId?: number;
  unitId?: number;
  hari?: HariPraktik;
  sesi?: SesiPraktik;
  status?: StatusAktifMaster;
}

@Injectable()
export class JadwalDokterService extends BaseTenantService<JadwalDokter> {
  constructor(
    @InjectRepository(JadwalDokter)
    private readonly repo: Repository<JadwalDokter>,
    private readonly dataSource: DataSource,
    tenantService: TenantContextService,
  ) {
    super(repo, tenantService, 'jadwalDokter');
  }

  async findAll(queryDto: QueryJadwalDokterDto) {
    const page = Math.max(1, Number(queryDto.page ?? 1) || 1);
    const limit = Math.max(
      1,
      Math.min(100, Number(queryDto.limit ?? 10) || 10),
    );
    const {
      search,
      dokterId,
      unitId,
      hari,
      sesi,
      status,
      sortBy = 'id',
      sortType = 'DESC',
    } = queryDto;

    const qb = this.createJoinedSelectQuery();
    this.applyCommonFilters(qb, {
      search,
      dokterId,
      unitId,
      hari,
      sesi,
      status,
    });

    const sortColumnMap: Record<string, string> = {
      id: 'jadwalDokter.id',
      hari: 'jadwalDokter.hariUrutan',
      jamMulai: 'jadwalDokter.jamMulai',
      jamSelesai: 'jadwalDokter.jamSelesai',
      kuotaTotal: 'jadwalDokter.kuotaTotal',
      createdAt: 'jadwalDokter.createdAt',
    };
    const orderExpr = sortColumnMap[sortBy] ?? 'jadwalDokter.id';
    const orderDirection = sortType === 'ASC' ? 'ASC' : 'DESC';

    qb.orderBy(orderExpr, orderDirection);
    if (sortBy === 'hari') {
      qb.addOrderBy('jadwalDokter.jamMulai', 'ASC');
    } else if (sortBy !== 'id') {
      qb.addOrderBy('jadwalDokter.id', 'DESC');
    }

    const [rows, totalItems] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const items = rows.map(enrichJadwalDokterItem);

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

  /**
   * Daftar jadwal dokter aktif untuk pilihan pendaftaran rawat jalan / antrean.
   */
  async findOptions(queryDto: QueryOptionsJadwalDokterDto) {
    let effectiveHari = queryDto.hari;

    if (queryDto.tanggal) {
      const hariDariTanggal = resolveHariDariTanggal(queryDto.tanggal);
      if (queryDto.hari && queryDto.hari !== hariDariTanggal) {
        throw new BadRequestException(
          `Tanggal ${queryDto.tanggal} jatuh pada hari ${hariDariTanggal}, tidak sesuai dengan filter hari ${queryDto.hari}.`,
        );
      }
      effectiveHari = hariDariTanggal;
    }

    const qb = this.createJoinedSelectQuery()
      .andWhere('jadwalDokter.status = :jadwalAktif', {
        jadwalAktif: StatusAktifMaster.AKTIF,
      })
      .andWhere('dokter.status = :dokterAktif', {
        dokterAktif: StatusAktifMaster.AKTIF,
      })
      .andWhere('unit.status = :unitAktif', {
        unitAktif: StatusAktifMaster.AKTIF,
      });

    this.applyCommonFilters(qb, {
      search: queryDto.search,
      dokterId: queryDto.dokterId,
      unitId: queryDto.unitId,
      hari: effectiveHari,
      sesi: queryDto.sesi,
    });

    const rows = await qb
      .orderBy('jadwalDokter.hariUrutan', 'ASC')
      .addOrderBy('jadwalDokter.jamMulai', 'ASC')
      .addOrderBy('unit.nama', 'ASC')
      .getMany();

    return rows.map(enrichJadwalDokterItem);
  }

  /**
   * Rekap jadwal praktik dokter aktif mingguan (Senin - Minggu) dalam 1 query tanpa N+1.
   */
  async getWeeklySchedule(queryDto: QueryMingguanJadwalDokterDto) {
    const qb = this.createJoinedSelectQuery()
      .andWhere('jadwalDokter.status = :jadwalAktif', {
        jadwalAktif: StatusAktifMaster.AKTIF,
      })
      .andWhere('dokter.status = :dokterAktif', {
        dokterAktif: StatusAktifMaster.AKTIF,
      })
      .andWhere('unit.status = :unitAktif', {
        unitAktif: StatusAktifMaster.AKTIF,
      });

    this.applyCommonFilters(qb, {
      search: queryDto.search,
      dokterId: queryDto.dokterId,
      unitId: queryDto.unitId,
      sesi: queryDto.sesi,
    });

    const rows = await qb
      .orderBy('jadwalDokter.hariUrutan', 'ASC')
      .addOrderBy('jadwalDokter.jamMulai', 'ASC')
      .addOrderBy('unit.nama', 'ASC')
      .getMany();

    const grouped = new Map<
      HariPraktik,
      Array<ReturnType<typeof enrichJadwalDokterItem>>
    >();
    for (const row of rows) {
      const hari = row.hari as HariPraktik;
      const bucket = grouped.get(hari) ?? [];
      bucket.push(enrichJadwalDokterItem(row));
      grouped.set(hari, bucket);
    }

    return HARI_PRAKTIK_ORDER.map((hari) => {
      const meta = HARI_PRAKTIK_METADATA[hari];
      const items = grouped.get(hari) ?? [];
      return {
        hari,
        label: meta.label,
        urutan: meta.urutan,
        kodeBpjs: meta.kodeBpjs,
        totalJadwal: items.length,
        items,
      };
    });
  }

  async findOne(id: number) {
    const item = await this.createJoinedSelectQuery()
      .andWhere('jadwalDokter.id = :id', { id })
      .getOne();

    if (!item) {
      throw new NotFoundException(
        `Jadwal dokter dengan ID #${id} tidak ditemukan.`,
      );
    }
    return enrichJadwalDokterItem(item);
  }

  async create(dto: CreateJadwalDokterDto) {
    const metrics = resolveAndValidateJadwalMetrics({
      jamMulai: dto.jamMulai,
      jamSelesai: dto.jamSelesai,
      durasiPerPasien: dto.durasiPerPasien,
      kuotaJkn: dto.kuotaJkn,
      kuotaNonJkn: dto.kuotaNonJkn,
      kuotaTotal: dto.kuotaTotal,
    });

    const tenantId = this.tenantId;
    const status = dto.status ?? StatusAktifMaster.AKTIF;

    const savedId = await this.dataSource.transaction(async (manager) => {
      await this.validateAndLockReferences(
        manager,
        tenantId,
        dto.dokterId,
        dto.unitId,
      );

      if (status === StatusAktifMaster.AKTIF) {
        await this.assertNoScheduleOverlap(manager, {
          tenantId,
          dokterId: dto.dokterId,
          hariList: [dto.hari],
          jamMulai: metrics.jamMulai,
          jamSelesai: metrics.jamSelesai,
        });
      }

      const entity = manager.create(JadwalDokter, {
        dokterId: dto.dokterId,
        unitId: dto.unitId,
        hari: dto.hari,
        hariUrutan: getHariUrutan(dto.hari),
        jamMulai: metrics.jamMulai,
        jamSelesai: metrics.jamSelesai,
        sesi: dto.sesi ?? null,
        ruangan: dto.ruangan ?? null,
        kuotaJkn: metrics.kuotaJkn,
        kuotaNonJkn: metrics.kuotaNonJkn,
        kuotaTotal: metrics.kuotaTotal,
        durasiPerPasien: metrics.durasiPerPasien,
        kodeJadwalBpjs: dto.kodeJadwalBpjs ?? null,
        ihsScheduleId: dto.ihsScheduleId ?? null,
        keterangan: dto.keterangan ?? null,
        status,
        tenantId,
      });

      const saved = await this.saveWithConstraintHandling(
        manager,
        entity,
        'Slot jadwal praktik aktif yang sama sudah terdaftar pada tenant ini.',
      );
      return saved.id;
    });

    return this.findOne(savedId);
  }

  async bulkCreate(dto: BulkCreateJadwalDokterDto) {
    const uniqueHariList = Array.from(new Set(dto.hariList));
    if (uniqueHariList.length === 0) {
      throw new BadRequestException('Minimal pilih 1 hari praktik.');
    }

    const metrics = resolveAndValidateJadwalMetrics({
      jamMulai: dto.jamMulai,
      jamSelesai: dto.jamSelesai,
      durasiPerPasien: dto.durasiPerPasien,
      kuotaJkn: dto.kuotaJkn,
      kuotaNonJkn: dto.kuotaNonJkn,
      kuotaTotal: dto.kuotaTotal,
    });

    const tenantId = this.tenantId;
    const status = dto.status ?? StatusAktifMaster.AKTIF;

    const savedIds = await this.dataSource.transaction(async (manager) => {
      await this.validateAndLockReferences(
        manager,
        tenantId,
        dto.dokterId,
        dto.unitId,
      );

      if (status === StatusAktifMaster.AKTIF) {
        await this.assertNoScheduleOverlap(manager, {
          tenantId,
          dokterId: dto.dokterId,
          hariList: uniqueHariList,
          jamMulai: metrics.jamMulai,
          jamSelesai: metrics.jamSelesai,
        });
      }

      const entities = uniqueHariList.map((hari) =>
        manager.create(JadwalDokter, {
          dokterId: dto.dokterId,
          unitId: dto.unitId,
          hari,
          hariUrutan: getHariUrutan(hari),
          jamMulai: metrics.jamMulai,
          jamSelesai: metrics.jamSelesai,
          sesi: dto.sesi ?? null,
          ruangan: dto.ruangan ?? null,
          kuotaJkn: metrics.kuotaJkn,
          kuotaNonJkn: metrics.kuotaNonJkn,
          kuotaTotal: metrics.kuotaTotal,
          durasiPerPasien: metrics.durasiPerPasien,
          kodeJadwalBpjs: dto.kodeJadwalBpjs ?? null,
          ihsScheduleId: dto.ihsScheduleId ?? null,
          keterangan: dto.keterangan ?? null,
          status,
          tenantId,
        }),
      );

      const saved = await this.saveWithConstraintHandling(
        manager,
        entities,
        'Terdapat slot jadwal praktik aktif duplikat pada tenant ini.',
      );
      return saved.map((row) => row.id);
    });

    const rows = await this.createJoinedSelectQuery()
      .andWhere('jadwalDokter.id IN (:...ids)', { ids: savedIds })
      .orderBy('jadwalDokter.hariUrutan', 'ASC')
      .addOrderBy('jadwalDokter.jamMulai', 'ASC')
      .getMany();

    return rows.map(enrichJadwalDokterItem);
  }

  async update(id: number, dto: UpdateJadwalDokterDto) {
    const tenantId = this.tenantId;

    await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(JadwalDokter, {
        where: { id, tenantId },
      });
      if (!existing) {
        throw new NotFoundException(
          `Jadwal dokter dengan ID #${id} tidak ditemukan.`,
        );
      }

      const targetDokterId = dto.dokterId ?? existing.dokterId;
      const targetUnitId = dto.unitId ?? existing.unitId;
      const targetHari = dto.hari ?? (existing.hari as HariPraktik);
      const targetStatus = dto.status ?? existing.status;

      const metrics = resolveAndValidateJadwalMetrics({
        jamMulai: dto.jamMulai ?? existing.jamMulai,
        jamSelesai: dto.jamSelesai ?? existing.jamSelesai,
        durasiPerPasien:
          dto.durasiPerPasien !== undefined
            ? dto.durasiPerPasien
            : existing.durasiPerPasien,
        kuotaJkn: dto.kuotaJkn ?? existing.kuotaJkn,
        kuotaNonJkn: dto.kuotaNonJkn ?? existing.kuotaNonJkn,
        kuotaTotal: dto.kuotaTotal ?? existing.kuotaTotal,
        autoSumEmptyTotal:
          dto.kuotaTotal === undefined &&
          (dto.kuotaJkn !== undefined || dto.kuotaNonJkn !== undefined) &&
          existing.kuotaTotal === 0,
      });

      await this.validateAndLockReferences(
        manager,
        tenantId,
        targetDokterId,
        targetUnitId,
      );

      if (targetStatus === String(StatusAktifMaster.AKTIF)) {
        await this.assertNoScheduleOverlap(manager, {
          tenantId,
          dokterId: targetDokterId,
          hariList: [targetHari],
          jamMulai: metrics.jamMulai,
          jamSelesai: metrics.jamSelesai,
          excludeId: id,
        });
      }

      Object.assign(existing, {
        dokterId: targetDokterId,
        unitId: targetUnitId,
        hari: targetHari,
        hariUrutan: getHariUrutan(targetHari),
        jamMulai: metrics.jamMulai,
        jamSelesai: metrics.jamSelesai,
        sesi: dto.sesi !== undefined ? dto.sesi : existing.sesi,
        ruangan: dto.ruangan !== undefined ? dto.ruangan : existing.ruangan,
        kuotaJkn: metrics.kuotaJkn,
        kuotaNonJkn: metrics.kuotaNonJkn,
        kuotaTotal: metrics.kuotaTotal,
        durasiPerPasien: metrics.durasiPerPasien,
        kodeJadwalBpjs:
          dto.kodeJadwalBpjs !== undefined
            ? dto.kodeJadwalBpjs
            : existing.kodeJadwalBpjs,
        ihsScheduleId:
          dto.ihsScheduleId !== undefined
            ? dto.ihsScheduleId
            : existing.ihsScheduleId,
        keterangan:
          dto.keterangan !== undefined ? dto.keterangan : existing.keterangan,
        status: targetStatus,
      });

      await this.saveWithConstraintHandling(
        manager,
        existing,
        'Slot jadwal praktik aktif yang sama sudah terdaftar pada tenant ini.',
      );
    });

    return this.findOne(id);
  }

  async updateStatus(id: number, dto: UpdateStatusJadwalDokterDto) {
    const tenantId = this.tenantId;

    await this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(JadwalDokter, {
        where: { id, tenantId },
      });
      if (!existing) {
        throw new NotFoundException(
          `Jadwal dokter dengan ID #${id} tidak ditemukan.`,
        );
      }

      if (dto.status === StatusAktifMaster.AKTIF) {
        await this.validateAndLockReferences(
          manager,
          tenantId,
          existing.dokterId,
          existing.unitId,
        );
        await this.assertNoScheduleOverlap(manager, {
          tenantId,
          dokterId: existing.dokterId,
          hariList: [existing.hari as HariPraktik],
          jamMulai: existing.jamMulai,
          jamSelesai: existing.jamSelesai,
          excludeId: id,
        });
      }

      existing.status = dto.status;
      if (dto.keterangan !== undefined) {
        existing.keterangan = dto.keterangan;
      }

      await this.saveWithConstraintHandling(
        manager,
        existing,
        'Slot jadwal praktik aktif yang sama sudah terdaftar pada tenant ini.',
      );
    });

    return this.findOne(id);
  }

  async remove(id: number) {
    const existing = await this.findOneById(id);
    await removeWithFkHandling(
      this.repo,
      existing,
      'Jadwal dokter tidak dapat dihapus karena masih digunakan pada transaksi pendaftaran atau antrean.',
    );
    return {
      message: `Jadwal dokter hari ${existing.hari} (${existing.jamMulai} - ${existing.jamSelesai}) berhasil dihapus.`,
    };
  }

  private createJoinedSelectQuery(): SelectQueryBuilder<JadwalDokter> {
    return this.createQuery()
      .leftJoin('jadwalDokter.dokter', 'dokter')
      .leftJoin('dokter.penduduk', 'penduduk')
      .leftJoin('jadwalDokter.unit', 'unit')
      .select([
        'jadwalDokter.id',
        'jadwalDokter.dokterId',
        'jadwalDokter.unitId',
        'jadwalDokter.hari',
        'jadwalDokter.hariUrutan',
        'jadwalDokter.jamMulai',
        'jadwalDokter.jamSelesai',
        'jadwalDokter.sesi',
        'jadwalDokter.ruangan',
        'jadwalDokter.kuotaJkn',
        'jadwalDokter.kuotaNonJkn',
        'jadwalDokter.kuotaTotal',
        'jadwalDokter.durasiPerPasien',
        'jadwalDokter.kodeJadwalBpjs',
        'jadwalDokter.ihsScheduleId',
        'jadwalDokter.keterangan',
        'jadwalDokter.status',
        'jadwalDokter.createdAt',
        'jadwalDokter.updatedAt',
        'dokter.id',
        'dokter.kodeDokter',
        'dokter.gelarDepan',
        'dokter.gelarBelakang',
        'dokter.jenisDokter',
        'dokter.spesialisasi',
        'dokter.kodeBpjs',
        'dokter.ihsPractitionerId',
        'dokter.status',
        'penduduk.id',
        'penduduk.namaLengkap',
        'unit.id',
        'unit.kode',
        'unit.nama',
        'unit.jenisUnit',
        'unit.kodeBpjsPoli',
        'unit.ihsLocationId',
        'unit.status',
      ]);
  }

  private applyCommonFilters(
    qb: SelectQueryBuilder<JadwalDokter>,
    filters: JadwalFilterCriteria,
  ): void {
    if (filters.search && filters.search.trim()) {
      const term = `%${filters.search.trim().toUpperCase()}%`;
      qb.andWhere(
        '(UPPER(dokter.kodeDokter) LIKE :term OR UPPER(penduduk.namaLengkap) LIKE :term OR UPPER(dokter.spesialisasi) LIKE :term OR UPPER(unit.kode) LIKE :term OR UPPER(unit.nama) LIKE :term OR UPPER(jadwalDokter.ruangan) LIKE :term OR UPPER(jadwalDokter.kodeJadwalBpjs) LIKE :term)',
        { term },
      );
    }

    if (filters.dokterId) {
      qb.andWhere('jadwalDokter.dokterId = :dokterId', {
        dokterId: filters.dokterId,
      });
    }

    if (filters.unitId) {
      qb.andWhere('jadwalDokter.unitId = :unitId', {
        unitId: filters.unitId,
      });
    }

    if (filters.hari) {
      qb.andWhere('jadwalDokter.hari = :hari', { hari: filters.hari });
    }

    if (filters.sesi) {
      qb.andWhere('jadwalDokter.sesi = :sesi', { sesi: filters.sesi });
    }

    if (filters.status) {
      qb.andWhere('jadwalDokter.status = :status', { status: filters.status });
    }
  }

  private async validateAndLockReferences(
    manager: EntityManager,
    tenantId: string,
    dokterId: number,
    unitId: number,
  ): Promise<void> {
    // Kunci baris dokter untuk mencegah race condition jadwal bentrok saat concurrent insert/update
    const dokter = await manager.findOne(Dokter, {
      where: { id: dokterId, tenantId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!dokter) {
      throw new BadRequestException(
        `Dokter dengan ID #${dokterId} tidak ditemukan.`,
      );
    }
    if (dokter.status !== String(StatusAktifMaster.AKTIF)) {
      throw new BadRequestException(
        `Dokter dengan ID #${dokterId} sedang nonaktif.`,
      );
    }

    const unit = await manager.findOne(Unit, {
      where: { id: unitId, tenantId },
    });
    if (!unit) {
      throw new BadRequestException(
        `Unit dengan ID #${unitId} tidak ditemukan.`,
      );
    }
    if (unit.status !== String(StatusAktifMaster.AKTIF)) {
      throw new BadRequestException(
        `Unit dengan ID #${unitId} sedang nonaktif.`,
      );
    }
  }

  private async assertNoScheduleOverlap(
    manager: EntityManager,
    params: {
      tenantId: string;
      dokterId: number;
      hariList: HariPraktik[];
      jamMulai: string;
      jamSelesai: string;
      excludeId?: number;
    },
  ): Promise<void> {
    const qb = manager
      .createQueryBuilder(JadwalDokter, 'jadwal')
      .leftJoin('jadwal.unit', 'unit')
      .select([
        'jadwal.id',
        'jadwal.hari',
        'jadwal.jamMulai',
        'jadwal.jamSelesai',
        'unit.id',
        'unit.nama',
      ])
      .where('jadwal.tenantId = :tenantId', { tenantId: params.tenantId })
      .andWhere('jadwal.dokterId = :dokterId', { dokterId: params.dokterId })
      .andWhere('jadwal.hari IN (:...hariList)', { hariList: params.hariList })
      .andWhere('jadwal.status = :aktif', { aktif: StatusAktifMaster.AKTIF })
      .andWhere('jadwal.jamMulai < CAST(:jamSelesai AS time)', {
        jamSelesai: params.jamSelesai,
      })
      .andWhere('jadwal.jamSelesai > CAST(:jamMulai AS time)', {
        jamMulai: params.jamMulai,
      });

    if (params.excludeId) {
      qb.andWhere('jadwal.id != :excludeId', { excludeId: params.excludeId });
    }

    const conflicts = await qb.getMany();
    if (conflicts.length > 0) {
      const detail = conflicts
        .map(
          (item) =>
            `${item.hari} di ${item.unit?.nama ?? `Unit #${item.unitId}`} (${item.jamMulai} - ${item.jamSelesai})`,
        )
        .join('; ');
      throw new ConflictException(
        `Jadwal praktik bentrok dengan jadwal aktif dokter lainnya pada: ${detail}.`,
      );
    }
  }

  private async saveWithConstraintHandling<
    T extends JadwalDokter | JadwalDokter[],
  >(manager: EntityManager, payload: T, conflictMessage: string): Promise<T> {
    try {
      return (await manager.save(JadwalDokter, payload as JadwalDokter)) as T;
    } catch (error: unknown) {
      if (getPostgresErrorCode(error) === '23505') {
        throw new ConflictException(conflictMessage);
      }
      throw error;
    }
  }
}
