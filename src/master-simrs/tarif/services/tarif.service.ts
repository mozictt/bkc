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
  FindOptionsWhere,
  IsNull,
  Not,
  Repository,
} from 'typeorm';
import { TarifTindakan } from '@entities/tarif-tindakan.entity';
import { TarifLayanan } from '@entities/tarif-layanan.entity';
import { Unit } from '@entities/unit.entity';
import { Penjamin } from '@entities/penjamin.entity';
import { Kelas } from '@entities/kelas.entity';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { BaseTenantService } from '@common/tenant/base-tenant.service';
import { JenisTarif, StatusAktifMaster } from '../../constants/simrs.enum';
import {
  assertActiveMasterRecord,
  assertUniqueTenantFields,
  removeWithFkHandling,
  saveWithUniqueHandling,
} from '../../helpers/master-entity.helper';
import { CreateTarifTindakanDto } from '../dto/create-tarif-tindakan.dto';
import { UpdateTarifTindakanDto } from '../dto/update-tarif-tindakan.dto';
import { QueryTarifDto, ResolveTarifDto } from '../dto/query-tarif.dto';
import {
  BulkCreateTarifLayananDto,
  CreateTarifLayananDto,
  UpdateTarifLayananDto,
} from '../dto/tarif-layanan.dto';
import {
  calculateTarifNominal,
  formatTarifLayananItem,
  getTodayIsoDate,
  isDateRangeOverlap,
  normalizeAtributKhusus,
  parseNumericMoney,
  resolveBestTarifRule,
  validateEffectiveDateRange,
} from '../helpers/tarif.helper';

interface TarifAggregateRawRow {
  tindakanId: string | number;
  jumlahTarif: string;
  jumlahTarifAktif: string;
  tarifTerendah: string | null;
  tarifTertinggi: string | null;
  jasaDokterMin: string | null;
  jasaDokterMax: string | null;
  jasaNakesMin: string | null;
  jasaNakesMax: string | null;
}

interface DimensionRefs {
  unitId: number | null;
  penjaminId: number | null;
  kelasId: number | null;
}

const MAX_BULK_MATRIX_COMBINATIONS = 100;

@Injectable()
export class TarifService extends BaseTenantService<TarifTindakan> {
  constructor(
    @InjectRepository(TarifTindakan)
    private readonly repo: Repository<TarifTindakan>,
    @InjectRepository(TarifLayanan)
    private readonly hargaRepo: Repository<TarifLayanan>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(Penjamin)
    private readonly penjaminRepo: Repository<Penjamin>,
    @InjectRepository(Kelas)
    private readonly kelasRepo: Repository<Kelas>,
    private readonly dataSource: DataSource,
    tenantService: TenantContextService,
  ) {
    super(repo, tenantService, 'tarifTindakan');
  }

  async findAll(queryDto: QueryTarifDto) {
    const page = Math.max(1, Number(queryDto.page ?? 1) || 1);
    const limit = Math.max(1, Math.min(100, Number(queryDto.limit ?? 10) || 10));
    const {
      search,
      jenisTarif,
      unitId,
      penjaminId,
      kelasId,
      status,
      sortBy = 'id',
      sortType = 'DESC',
    } = queryDto;

    const qb = this.createQuery();

    if (search && search.trim()) {
      const term = `%${search.trim().toUpperCase()}%`;
      qb.andWhere(
        `(UPPER(tarifTindakan.kode) LIKE :term OR UPPER(tarifTindakan.nama) LIKE :term OR UPPER(COALESCE(tarifTindakan.kelompokTarif, '')) LIKE :term OR UPPER(COALESCE(tarifTindakan.kodeEksternal, '')) LIKE :term)`,
        { term },
      );
    }

    if (jenisTarif) {
      qb.andWhere('tarifTindakan.jenisTarif = :jenisTarif', { jenisTarif });
    }

    if (status) {
      qb.andWhere('tarifTindakan.status = :status', { status });
    }

    if (unitId || penjaminId || kelasId) {
      const subConditions = [
        'tl.tindakan_id = tarifTindakan.id',
        'tl.tenant_id = :filterTenantId',
      ];
      const subParams: Record<string, unknown> = {
        filterTenantId: this.tenantId,
      };

      if (unitId) {
        subConditions.push('tl.unit_id = :filterUnitId');
        subParams.filterUnitId = unitId;
      }
      if (penjaminId) {
        subConditions.push('tl.penjamin_id = :filterPenjaminId');
        subParams.filterPenjaminId = penjaminId;
      }
      if (kelasId) {
        subConditions.push('tl.kelas_id = :filterKelasId');
        subParams.filterKelasId = kelasId;
      }

      qb.andWhere(
        `EXISTS (SELECT 1 FROM tarif_layanan tl WHERE ${subConditions.join(' AND ')})`,
        subParams,
      );
    }

    const allowedSort = ['id', 'kode', 'nama', 'jenisTarif', 'createdAt'];
    const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'id';
    const orderDirection = sortType === 'ASC' ? 'ASC' : 'DESC';

    const [rows, totalItems] = await qb
      .orderBy(`tarifTindakan.${orderColumn}`, orderDirection)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const statsMap = await this.fetchAggregatesByTindakanIds(
      rows.map((item) => item.id),
    );

    const items = rows.map((row) => {
      const stats = statsMap.get(row.id);
      return {
        ...row,
        jumlahTarif: stats?.jumlahTarif ?? 0,
        jumlahTarifAktif: stats?.jumlahTarifAktif ?? 0,
        tarifTerendah: stats?.tarifTerendah ?? null,
        tarifTertinggi: stats?.tarifTertinggi ?? null,
        jasaDokterMin: stats?.jasaDokterMin ?? null,
        jasaDokterMax: stats?.jasaDokterMax ?? null,
        jasaNakesMin: stats?.jasaNakesMin ?? null,
        jasaNakesMax: stats?.jasaNakesMax ?? null,
      };
    });

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

  async findOptions(search = '', jenisTarif?: JenisTarif) {
    const qb = this.createQuery()
      .select([
        'tarifTindakan.id',
        'tarifTindakan.kode',
        'tarifTindakan.nama',
        'tarifTindakan.jenisTarif',
        'tarifTindakan.kelompokTarif',
        'tarifTindakan.satuan',
      ])
      .andWhere('tarifTindakan.status = :status', { status: 'Y' });

    if (jenisTarif) {
      qb.andWhere('tarifTindakan.jenisTarif = :jenisTarif', { jenisTarif });
    }

    if (search.trim()) {
      const term = `%${search.trim().toUpperCase()}%`;
      qb.andWhere(
        '(UPPER(tarifTindakan.kode) LIKE :term OR UPPER(tarifTindakan.nama) LIKE :term)',
        { term },
      );
    }

    return qb.orderBy('tarifTindakan.nama', 'ASC').limit(50).getMany();
  }

  async findOne(id: number) {
    const tindakan = await this.repo.findOne({
      where: { id, tenantId: this.tenantId },
    });
    if (!tindakan) {
      throw new NotFoundException(
        `Master tarif tindakan dengan ID #${id} tidak ditemukan.`,
      );
    }

    const daftarHarga = await this.fetchFormattedHargaList(id);
    const activeTotals = daftarHarga
      .filter((item) => item.status === 'Y')
      .map((item) => item.totalTarif);

    return {
      ...tindakan,
      jumlahTarif: daftarHarga.length,
      jumlahTarifAktif: activeTotals.length,
      tarifTerendah:
        activeTotals.length > 0 ? Math.min(...activeTotals) : null,
      tarifTertinggi:
        activeTotals.length > 0 ? Math.max(...activeTotals) : null,
      daftarHarga,
    };
  }

  async resolveTarif(queryDto: ResolveTarifDto) {
    const tenantId = this.tenantId;
    const tindakan = await assertActiveMasterRecord(
      this.repo,
      queryDto.tindakanId,
      tenantId,
      'Master tarif tindakan',
      false,
    );

    const [unit, penjamin, kelas] = await Promise.all([
      queryDto.unitId
        ? assertActiveMasterRecord(
            this.unitRepo,
            queryDto.unitId,
            tenantId,
            'Master Unit',
          )
        : Promise.resolve(null),
      queryDto.penjaminId
        ? assertActiveMasterRecord(
            this.penjaminRepo,
            queryDto.penjaminId,
            tenantId,
            'Master Penjamin',
          )
        : Promise.resolve(null),
      queryDto.kelasId
        ? assertActiveMasterRecord(
            this.kelasRepo,
            queryDto.kelasId,
            tenantId,
            'Master Kelas',
          )
        : Promise.resolve(null),
    ]);

    const tanggal =
      queryDto.tanggal && queryDto.tanggal.trim() !== ''
        ? queryDto.tanggal.trim().slice(0, 10)
        : getTodayIsoDate();

    const qb = this.hargaRepo
      .createQueryBuilder('tl')
      .leftJoin('tl.unit', 'unit')
      .leftJoin('tl.penjamin', 'penjamin')
      .leftJoin('tl.kelas', 'kelas')
      .select([
        'tl',
        'unit.id',
        'unit.kode',
        'unit.nama',
        'unit.jenisUnit',
        'penjamin.id',
        'penjamin.kode',
        'penjamin.nama',
        'penjamin.jenisPenjamin',
        'kelas.id',
        'kelas.kode',
        'kelas.nama',
        'kelas.urutan',
      ])
      .where('tl.tenantId = :tenantId', { tenantId })
      .andWhere('tl.tindakanId = :tindakanId', { tindakanId: tindakan.id })
      .andWhere('tl.status = :status', { status: 'Y' })
      .andWhere('tl.berlakuMulai <= :tanggal', { tanggal })
      .andWhere('(tl.berlakuSampai IS NULL OR tl.berlakuSampai >= :tanggal)', {
        tanggal,
      });

    if (queryDto.unitId) {
      qb.andWhere('(tl.unitId = :unitId OR tl.unitId IS NULL)', {
        unitId: queryDto.unitId,
      });
    } else {
      qb.andWhere('tl.unitId IS NULL');
    }

    if (queryDto.penjaminId) {
      qb.andWhere('(tl.penjaminId = :penjaminId OR tl.penjaminId IS NULL)', {
        penjaminId: queryDto.penjaminId,
      });
    } else {
      qb.andWhere('tl.penjaminId IS NULL');
    }

    if (queryDto.kelasId) {
      qb.andWhere('(tl.kelasId = :kelasId OR tl.kelasId IS NULL)', {
        kelasId: queryDto.kelasId,
      });
    } else {
      qb.andWhere('tl.kelasId IS NULL');
    }

    const candidates = await qb.getMany();
    const resolution = resolveBestTarifRule(candidates, {
      unitId: queryDto.unitId ?? null,
      penjaminId: queryDto.penjaminId ?? null,
      kelasId: queryDto.kelasId ?? null,
    });

    return {
      ...resolution,
      prioritas: 'UNIT -> PENJAMIN -> KELAS',
      tindakan: {
        id: tindakan.id,
        kode: tindakan.kode,
        nama: tindakan.nama,
        jenisTarif: tindakan.jenisTarif,
        satuan: tindakan.satuan,
      },
      konteks: {
        tanggal,
        unit: unit ? { id: unit.id, kode: unit.kode, nama: unit.nama } : null,
        penjamin: penjamin
          ? { id: penjamin.id, kode: penjamin.kode, nama: penjamin.nama }
          : null,
        kelas: kelas
          ? { id: kelas.id, kode: kelas.kode, nama: kelas.nama }
          : null,
      },
    };
  }

  async create(dto: CreateTarifTindakanDto) {
    const tenantId = this.tenantId;
    await assertUniqueTenantFields(this.repo, tenantId, [
      { field: 'kode', value: dto.kode, label: 'Kode tarif' },
    ]);
    await this.assertUniqueNamaJenis(dto.nama, dto.jenisTarif);

    const { tarifDefault, berlakuMulaiDefault, atributKhusus, ...rest } = dto;
    const savedId = await this.dataSource.transaction(async (manager) => {
      const tindakanRepo = manager.getRepository(TarifTindakan);
      const hargaRepo = manager.getRepository(TarifLayanan);

      const entity = tindakanRepo.create({
        ...rest,
        tenantId,
        satuan: rest.satuan || 'Tindakan',
        atributKhusus: normalizeAtributKhusus(rest.jenisTarif, atributKhusus),
      });

      const created = await saveWithUniqueHandling(
        tindakanRepo,
        entity,
        'Kode atau nama tarif pada kategori ini sudah terdaftar.',
      );

      if (tarifDefault) {
        const calc = calculateTarifNominal(tarifDefault);
        const { berlakuMulai } = validateEffectiveDateRange(
          berlakuMulaiDefault,
          null,
        );
        const defaultHarga = hargaRepo.create({
          tenantId,
          tindakanId: created.id,
          unitId: null,
          penjaminId: null,
          kelasId: null,
          jasaSarana: calc.jasaSarana,
          bhp: calc.bhp,
          jasaDokter: calc.jasaDokter,
          jasaNakes: calc.jasaNakes,
          totalTarif: calc.totalTarif,
          berlakuMulai,
          berlakuSampai: null,
          keterangan: 'Tarif dasar default',
          status: StatusAktifMaster.AKTIF,
        });
        await hargaRepo.save(defaultHarga);
      }

      return created.id;
    });

    return this.findOne(savedId);
  }

  async update(id: number, dto: UpdateTarifTindakanDto) {
    const existing = await this.repo.findOne({
      where: { id, tenantId: this.tenantId },
    });
    if (!existing) {
      throw new NotFoundException(
        `Master tarif tindakan dengan ID #${id} tidak ditemukan.`,
      );
    }

    const nextKode = dto.kode ?? existing.kode;
    const nextNama = dto.nama ?? existing.nama;
    const nextJenis = dto.jenisTarif ?? existing.jenisTarif;

    await assertUniqueTenantFields(
      this.repo,
      this.tenantId,
      [{ field: 'kode', value: nextKode, label: 'Kode tarif' }],
      id,
    );
    await this.assertUniqueNamaJenis(nextNama, nextJenis, id);

    const { atributKhusus, ...rest } = dto;
    Object.assign(existing, rest);
    if (atributKhusus !== undefined || dto.jenisTarif !== undefined) {
      const rawMeta =
        atributKhusus !== undefined ? atributKhusus : existing.atributKhusus;
      existing.atributKhusus = normalizeAtributKhusus(nextJenis, rawMeta);
    }

    await saveWithUniqueHandling(
      this.repo,
      existing,
      'Kode atau nama tarif pada kategori ini sudah terdaftar.',
    );

    return this.findOne(id);
  }

  async remove(id: number) {
    const existing = await this.repo.findOne({
      where: { id, tenantId: this.tenantId },
    });
    if (!existing) {
      throw new NotFoundException(
        `Master tarif tindakan dengan ID #${id} tidak ditemukan.`,
      );
    }

    await removeWithFkHandling(
      this.repo,
      existing,
      'Tarif tindakan tidak dapat dihapus karena masih digunakan pada data transaksi atau referensi lain.',
    );
    return { message: `Master tarif "${existing.nama}" berhasil dihapus.` };
  }

  async createHarga(tindakanId: number, dto: CreateTarifLayananDto) {
    const tenantId = this.tenantId;
    const refs = await this.validateDimensions(tenantId, {
      unitId: dto.unitId ?? null,
      penjaminId: dto.penjaminId ?? null,
      kelasId: dto.kelasId ?? null,
    });
    const { berlakuMulai, berlakuSampai } = validateEffectiveDateRange(
      dto.berlakuMulai,
      dto.berlakuSampai ?? null,
    );
    const calc = calculateTarifNominal(dto);
    const targetStatus = dto.status ?? StatusAktifMaster.AKTIF;

    const savedId = await this.dataSource.transaction(async (manager) => {
      await this.lockParentTindakan(manager, tindakanId, tenantId);
      const hargaRepo = manager.getRepository(TarifLayanan);

      if (targetStatus === StatusAktifMaster.AKTIF) {
        await this.assertNoOverlappingActiveRule(hargaRepo, {
          tenantId,
          tindakanId,
          ...refs,
          berlakuMulai,
          berlakuSampai,
        });
      }

      const created = hargaRepo.create({
        tenantId,
        tindakanId,
        ...refs,
        jasaSarana: calc.jasaSarana,
        bhp: calc.bhp,
        jasaDokter: calc.jasaDokter,
        jasaNakes: calc.jasaNakes,
        totalTarif: calc.totalTarif,
        berlakuMulai,
        berlakuSampai,
        keterangan: dto.keterangan ?? null,
        status: targetStatus,
      });

      const saved = await hargaRepo.save(created);
      return saved.id;
    });

    return this.findOneHarga(savedId);
  }

  async bulkCreateHarga(tindakanId: number, dto: BulkCreateTarifLayananDto) {
    const tenantId = this.tenantId;
    const unitList: Array<number | null> =
      dto.unitIds && dto.unitIds.length > 0
        ? Array.from(new Set(dto.unitIds))
        : [null];
    const penjaminList: Array<number | null> =
      dto.penjaminIds && dto.penjaminIds.length > 0
        ? Array.from(new Set(dto.penjaminIds))
        : [null];
    const kelasList: Array<number | null> =
      dto.kelasIds && dto.kelasIds.length > 0
        ? Array.from(new Set(dto.kelasIds))
        : [null];

    const totalCombos =
      unitList.length * penjaminList.length * kelasList.length;
    if (totalCombos > MAX_BULK_MATRIX_COMBINATIONS) {
      throw new BadRequestException(
        `Kombinasi matriks melebihi batas maksimal ${MAX_BULK_MATRIX_COMBINATIONS} aturan sekaligus (${totalCombos} kombinasi).`,
      );
    }

    await Promise.all([
      ...unitList
        .filter((id): id is number => id !== null)
        .map((id) =>
          assertActiveMasterRecord(this.unitRepo, id, tenantId, 'Master Unit'),
        ),
      ...penjaminList
        .filter((id): id is number => id !== null)
        .map((id) =>
          assertActiveMasterRecord(
            this.penjaminRepo,
            id,
            tenantId,
            'Master Penjamin',
          ),
        ),
      ...kelasList
        .filter((id): id is number => id !== null)
        .map((id) =>
          assertActiveMasterRecord(
            this.kelasRepo,
            id,
            tenantId,
            'Master Kelas',
          ),
        ),
    ]);

    const { berlakuMulai, berlakuSampai } = validateEffectiveDateRange(
      dto.berlakuMulai,
      dto.berlakuSampai ?? null,
    );
    const calc = calculateTarifNominal(dto);
    const targetStatus = dto.status ?? StatusAktifMaster.AKTIF;
    const mode = dto.modeDuplikat ?? 'SKIP';

    const summary = await this.dataSource.transaction(async (manager) => {
      await this.lockParentTindakan(manager, tindakanId, tenantId);
      const hargaRepo = manager.getRepository(TarifLayanan);

      const existingActive = await hargaRepo.find({
        where: { tenantId, tindakanId, status: StatusAktifMaster.AKTIF },
      });

      let createdCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;

      for (const unitId of unitList) {
        for (const penjaminId of penjaminList) {
          for (const kelasId of kelasList) {
            const match = existingActive.find(
              (item) =>
                item.unitId === unitId &&
                item.penjaminId === penjaminId &&
                item.kelasId === kelasId &&
                isDateRangeOverlap(
                  item.berlakuMulai,
                  item.berlakuSampai,
                  berlakuMulai,
                  berlakuSampai,
                ),
            );

            if (match && targetStatus === StatusAktifMaster.AKTIF) {
              if (mode === 'SKIP') {
                skippedCount++;
                continue;
              }
              Object.assign(match, {
                jasaSarana: calc.jasaSarana,
                bhp: calc.bhp,
                jasaDokter: calc.jasaDokter,
                jasaNakes: calc.jasaNakes,
                totalTarif: calc.totalTarif,
                berlakuMulai,
                berlakuSampai,
                keterangan: dto.keterangan ?? match.keterangan,
                status: targetStatus,
              });
              await hargaRepo.save(match);
              updatedCount++;
              continue;
            }

            const newRow = hargaRepo.create({
              tenantId,
              tindakanId,
              unitId,
              penjaminId,
              kelasId,
              jasaSarana: calc.jasaSarana,
              bhp: calc.bhp,
              jasaDokter: calc.jasaDokter,
              jasaNakes: calc.jasaNakes,
              totalTarif: calc.totalTarif,
              berlakuMulai,
              berlakuSampai,
              keterangan: dto.keterangan ?? null,
              status: targetStatus,
            });
            const saved = await hargaRepo.save(newRow);
            if (targetStatus === StatusAktifMaster.AKTIF) {
              existingActive.push(saved);
            }
            createdCount++;
          }
        }
      }

      return { createdCount, updatedCount, skippedCount, totalCombos };
    });

    const detail = await this.findOne(tindakanId);
    return {
      ...summary,
      tindakan: detail,
    };
  }

  async updateHarga(hargaId: number, dto: UpdateTarifLayananDto) {
    const tenantId = this.tenantId;
    const existing = await this.hargaRepo.findOne({
      where: { id: hargaId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException(
        `Aturan tarif layanan dengan ID #${hargaId} tidak ditemukan.`,
      );
    }

    const nextUnitId = dto.unitId !== undefined ? dto.unitId : existing.unitId;
    const nextPenjaminId =
      dto.penjaminId !== undefined ? dto.penjaminId : existing.penjaminId;
    const nextKelasId =
      dto.kelasId !== undefined ? dto.kelasId : existing.kelasId;

    const refs = await this.validateDimensions(tenantId, {
      unitId: nextUnitId,
      penjaminId: nextPenjaminId,
      kelasId: nextKelasId,
    });

    const nextStart =
      dto.berlakuMulai !== undefined ? dto.berlakuMulai : existing.berlakuMulai;
    const nextEnd =
      dto.berlakuSampai !== undefined
        ? dto.berlakuSampai
        : existing.berlakuSampai;
    const { berlakuMulai, berlakuSampai } = validateEffectiveDateRange(
      nextStart,
      nextEnd,
    );

    const calc = calculateTarifNominal({
      jasaSarana:
        dto.jasaSarana !== undefined
          ? dto.jasaSarana
          : parseNumericMoney(existing.jasaSarana),
      bhp: dto.bhp !== undefined ? dto.bhp : parseNumericMoney(existing.bhp),
      jasaDokter:
        dto.jasaDokter !== undefined
          ? dto.jasaDokter
          : parseNumericMoney(existing.jasaDokter),
      jasaNakes:
        dto.jasaNakes !== undefined
          ? dto.jasaNakes
          : parseNumericMoney(existing.jasaNakes),
    });

    const targetStatus = dto.status ?? existing.status;

    await this.dataSource.transaction(async (manager) => {
      await this.lockParentTindakan(manager, existing.tindakanId, tenantId);
      const hargaRepo = manager.getRepository(TarifLayanan);

      if (targetStatus === StatusAktifMaster.AKTIF) {
        await this.assertNoOverlappingActiveRule(
          hargaRepo,
          {
            tenantId,
            tindakanId: existing.tindakanId,
            ...refs,
            berlakuMulai,
            berlakuSampai,
          },
          hargaId,
        );
      }

      const row = await hargaRepo.findOne({
        where: { id: hargaId, tenantId },
      });
      if (!row) {
        throw new NotFoundException(
          `Aturan tarif layanan dengan ID #${hargaId} tidak ditemukan.`,
        );
      }

      Object.assign(row, {
        ...refs,
        jasaSarana: calc.jasaSarana,
        bhp: calc.bhp,
        jasaDokter: calc.jasaDokter,
        jasaNakes: calc.jasaNakes,
        totalTarif: calc.totalTarif,
        berlakuMulai,
        berlakuSampai,
        keterangan:
          dto.keterangan !== undefined ? dto.keterangan : row.keterangan,
        status: targetStatus,
      });

      await hargaRepo.save(row);
    });

    return this.findOneHarga(hargaId);
  }

  async removeHarga(hargaId: number) {
    const existing = await this.hargaRepo.findOne({
      where: { id: hargaId, tenantId: this.tenantId },
    });
    if (!existing) {
      throw new NotFoundException(
        `Aturan tarif layanan dengan ID #${hargaId} tidak ditemukan.`,
      );
    }

    await removeWithFkHandling(
      this.hargaRepo,
      existing,
      'Aturan tarif ini tidak dapat dihapus karena masih digunakan pada data transaksi.',
    );

    return { message: 'Aturan tarif berhasil dihapus.' };
  }

  private async findOneHarga(hargaId: number) {
    const row = await this.hargaRepo
      .createQueryBuilder('tl')
      .leftJoin('tl.unit', 'unit')
      .leftJoin('tl.penjamin', 'penjamin')
      .leftJoin('tl.kelas', 'kelas')
      .select([
        'tl',
        'unit.id',
        'unit.kode',
        'unit.nama',
        'unit.jenisUnit',
        'penjamin.id',
        'penjamin.kode',
        'penjamin.nama',
        'penjamin.jenisPenjamin',
        'kelas.id',
        'kelas.kode',
        'kelas.nama',
        'kelas.urutan',
      ])
      .where('tl.id = :hargaId', { hargaId })
      .andWhere('tl.tenantId = :tenantId', { tenantId: this.tenantId })
      .getOne();

    if (!row) {
      throw new NotFoundException(
        `Aturan tarif layanan dengan ID #${hargaId} tidak ditemukan.`,
      );
    }

    return formatTarifLayananItem(row);
  }

  private async fetchFormattedHargaList(tindakanId: number) {
    const rows = await this.hargaRepo
      .createQueryBuilder('tl')
      .leftJoin('tl.unit', 'unit')
      .leftJoin('tl.penjamin', 'penjamin')
      .leftJoin('tl.kelas', 'kelas')
      .select([
        'tl',
        'unit.id',
        'unit.kode',
        'unit.nama',
        'unit.jenisUnit',
        'penjamin.id',
        'penjamin.kode',
        'penjamin.nama',
        'penjamin.jenisPenjamin',
        'kelas.id',
        'kelas.kode',
        'kelas.nama',
        'kelas.urutan',
      ])
      .where('tl.tenantId = :tenantId', { tenantId: this.tenantId })
      .andWhere('tl.tindakanId = :tindakanId', { tindakanId })
      .getMany();

    return rows
      .map(formatTarifLayananItem)
      .sort((a, b) => {
        if (b.specificityScore !== a.specificityScore) {
          return b.specificityScore - a.specificityScore;
        }
        if (a.status !== b.status) {
          return a.status === 'Y' ? -1 : 1;
        }
        return a.id - b.id;
      });
  }

  private async fetchAggregatesByTindakanIds(tindakanIds: number[]) {
    const result = new Map<
      number,
      {
        jumlahTarif: number;
        jumlahTarifAktif: number;
        tarifTerendah: number | null;
        tarifTertinggi: number | null;
        jasaDokterMin: number | null;
        jasaDokterMax: number | null;
        jasaNakesMin: number | null;
        jasaNakesMax: number | null;
      }
    >();

    if (tindakanIds.length === 0) return result;

    const rows = await this.hargaRepo
      .createQueryBuilder('tl')
      .select('tl.tindakanId', 'tindakanId')
      .addSelect('COUNT(tl.id)', 'jumlahTarif')
      .addSelect(
        `SUM(CASE WHEN tl.status = 'Y' THEN 1 ELSE 0 END)`,
        'jumlahTarifAktif',
      )
      .addSelect(
        `MIN(CASE WHEN tl.status = 'Y' THEN tl.totalTarif ELSE NULL END)`,
        'tarifTerendah',
      )
      .addSelect(
        `MAX(CASE WHEN tl.status = 'Y' THEN tl.totalTarif ELSE NULL END)`,
        'tarifTertinggi',
      )
      .addSelect(
        `MIN(CASE WHEN tl.status = 'Y' THEN tl.jasaDokter ELSE NULL END)`,
        'jasaDokterMin',
      )
      .addSelect(
        `MAX(CASE WHEN tl.status = 'Y' THEN tl.jasaDokter ELSE NULL END)`,
        'jasaDokterMax',
      )
      .addSelect(
        `MIN(CASE WHEN tl.status = 'Y' THEN tl.jasaNakes ELSE NULL END)`,
        'jasaNakesMin',
      )
      .addSelect(
        `MAX(CASE WHEN tl.status = 'Y' THEN tl.jasaNakes ELSE NULL END)`,
        'jasaNakesMax',
      )
      .where('tl.tenantId = :tenantId', { tenantId: this.tenantId })
      .andWhere('tl.tindakanId IN (:...ids)', { ids: tindakanIds })
      .groupBy('tl.tindakanId')
      .getRawMany<TarifAggregateRawRow>();

    for (const row of rows) {
      const id = Number(row.tindakanId);
      const activeCount = Number(row.jumlahTarifAktif || 0);
      result.set(id, {
        jumlahTarif: Number(row.jumlahTarif || 0),
        jumlahTarifAktif: activeCount,
        tarifTerendah:
          row.tarifTerendah !== null
            ? parseNumericMoney(row.tarifTerendah)
            : null,
        tarifTertinggi:
          row.tarifTertinggi !== null
            ? parseNumericMoney(row.tarifTertinggi)
            : null,
        jasaDokterMin:
          row.jasaDokterMin !== null
            ? parseNumericMoney(row.jasaDokterMin)
            : null,
        jasaDokterMax:
          row.jasaDokterMax !== null
            ? parseNumericMoney(row.jasaDokterMax)
            : null,
        jasaNakesMin:
          row.jasaNakesMin !== null
            ? parseNumericMoney(row.jasaNakesMin)
            : null,
        jasaNakesMax:
          row.jasaNakesMax !== null
            ? parseNumericMoney(row.jasaNakesMax)
            : null,
      });
    }

    return result;
  }

  private async assertUniqueNamaJenis(
    nama: string,
    jenisTarif: string,
    excludeId?: number,
  ) {
    const where: FindOptionsWhere<TarifTindakan> = {
      tenantId: this.tenantId,
      nama,
      jenisTarif,
      ...(excludeId ? { id: Not(excludeId) } : {}),
    };
    const found = await this.repo.findOne({ where, select: ['id'] });
    if (found) {
      throw new ConflictException(
        `Nama tindakan "${nama}" pada kategori ${jenisTarif} sudah digunakan.`,
      );
    }
  }

  private async lockParentTindakan(
    manager: EntityManager,
    tindakanId: number,
    tenantId: string,
  ) {
    const parent = await manager.findOne(TarifTindakan, {
      where: { id: tindakanId, tenantId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!parent) {
      throw new NotFoundException(
        `Master tarif tindakan dengan ID #${tindakanId} tidak ditemukan.`,
      );
    }
    return parent;
  }

  private async validateDimensions(
    tenantId: string,
    refs: DimensionRefs,
  ): Promise<DimensionRefs> {
    await Promise.all([
      refs.unitId !== null
        ? assertActiveMasterRecord(
            this.unitRepo,
            refs.unitId,
            tenantId,
            'Master Unit',
          )
        : Promise.resolve(null),
      refs.penjaminId !== null
        ? assertActiveMasterRecord(
            this.penjaminRepo,
            refs.penjaminId,
            tenantId,
            'Master Penjamin',
          )
        : Promise.resolve(null),
      refs.kelasId !== null
        ? assertActiveMasterRecord(
            this.kelasRepo,
            refs.kelasId,
            tenantId,
            'Master Kelas',
          )
        : Promise.resolve(null),
    ]);

    return refs;
  }

  private async assertNoOverlappingActiveRule(
    hargaRepo: Repository<TarifLayanan>,
    params: {
      tenantId: string;
      tindakanId: number;
      unitId: number | null;
      penjaminId: number | null;
      kelasId: number | null;
      berlakuMulai: string;
      berlakuSampai: string | null;
    },
    excludeId?: number,
  ) {
    const where: FindOptionsWhere<TarifLayanan> = {
      tenantId: params.tenantId,
      tindakanId: params.tindakanId,
      unitId: params.unitId === null ? IsNull() : params.unitId,
      penjaminId: params.penjaminId === null ? IsNull() : params.penjaminId,
      kelasId: params.kelasId === null ? IsNull() : params.kelasId,
      status: StatusAktifMaster.AKTIF,
      ...(excludeId ? { id: Not(excludeId) } : {}),
    };

    const existingRows = await hargaRepo.find({ where });
    const conflict = existingRows.find((row) =>
      isDateRangeOverlap(
        row.berlakuMulai,
        row.berlakuSampai,
        params.berlakuMulai,
        params.berlakuSampai,
      ),
    );

    if (conflict) {
      throw new ConflictException(
        'Aturan tarif aktif untuk kombinasi Unit, Penjamin, dan Kelas pada periode tanggal tersebut sudah ada.',
      );
    }
  }
}
