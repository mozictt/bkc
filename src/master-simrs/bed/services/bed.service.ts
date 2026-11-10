import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Bed } from '@entities/bed.entity';
import { Unit } from '@entities/unit.entity';
import { Kelas } from '@entities/kelas.entity';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { BaseTenantService } from '@common/tenant/base-tenant.service';
import { StatusKetersediaanBed } from '../../constants/simrs.enum';
import {
  assertActiveMasterRecord,
  assertUniqueTenantFields,
  removeWithFkHandling,
  saveWithUniqueHandling,
} from '../../helpers/master-entity.helper';
import {
  CreateBedDto,
  UpdateStatusKetersediaanBedDto,
} from '../dto/create-bed.dto';
import { UpdateBedDto } from '../dto/update-bed.dto';
import { QueryBedDto } from '../dto/query-bed.dto';

interface BedSummaryRawRow {
  unitId: number;
  unitKode: string;
  unitNama: string;
  kelasId: number;
  kelasKode: string;
  kelasNama: string;
  totalBed: string;
  kosong: string;
  terisi: string;
  booking: string;
  pembersihan: string;
  perbaikan: string;
}

@Injectable()
export class BedService extends BaseTenantService<Bed> {
  constructor(
    @InjectRepository(Bed)
    private readonly repo: Repository<Bed>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(Kelas)
    private readonly kelasRepo: Repository<Kelas>,
    tenantService: TenantContextService,
  ) {
    super(repo, tenantService, 'bed');
  }

  async findAll(queryDto: QueryBedDto) {
    const page = Math.max(1, queryDto.page ?? 1);
    const limit = Math.max(1, Math.min(100, queryDto.limit ?? 10));
    const {
      search,
      unitId,
      kelasId,
      statusKetersediaan,
      isIsolasi,
      status,
      sortBy = 'id',
      sortType = 'DESC',
    } = queryDto;

    const qb = this.createQuery()
      .leftJoin('bed.unit', 'unit')
      .leftJoin('bed.kelas', 'kelas')
      .select([
        'bed.id',
        'bed.kode',
        'bed.nama',
        'bed.unitId',
        'bed.kelasId',
        'bed.namaKamar',
        'bed.statusKetersediaan',
        'bed.isIsolasi',
        'bed.ihsLocationId',
        'bed.keterangan',
        'bed.status',
        'bed.createdAt',
        'unit.id',
        'unit.kode',
        'unit.nama',
        'unit.jenisUnit',
        'kelas.id',
        'kelas.kode',
        'kelas.nama',
        'kelas.urutan',
        'kelas.kodeBpjsAplicare',
      ]);

    if (search && search.trim()) {
      const term = `%${search.trim().toUpperCase()}%`;
      qb.andWhere(
        '(UPPER(bed.kode) LIKE :term OR UPPER(bed.nama) LIKE :term OR UPPER(bed.namaKamar) LIKE :term OR UPPER(unit.nama) LIKE :term OR UPPER(kelas.nama) LIKE :term)',
        { term },
      );
    }

    if (unitId) {
      qb.andWhere('bed.unitId = :unitId', { unitId });
    }

    if (kelasId) {
      qb.andWhere('bed.kelasId = :kelasId', { kelasId });
    }

    if (statusKetersediaan) {
      qb.andWhere('bed.statusKetersediaan = :statusKetersediaan', {
        statusKetersediaan,
      });
    }

    if (isIsolasi !== undefined) {
      qb.andWhere('bed.isIsolasi = :isIsolasi', { isIsolasi });
    }

    if (status) {
      qb.andWhere('bed.status = :status', { status });
    }

    const allowedSort = [
      'id',
      'kode',
      'nama',
      'namaKamar',
      'statusKetersediaan',
      'createdAt',
    ];
    const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'id';
    const orderDirection = sortType === 'ASC' ? 'ASC' : 'DESC';

    const [items, totalItems] = await qb
      .orderBy(`bed.${orderColumn}`, orderDirection)
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

  /**
   * Daftar bed aktif yang berstatus KOSONG untuk pilihan tempat tidur admisi rawat inap / IGD.
   */
  async findAvailableOptions(unitId?: number, kelasId?: number) {
    const qb = this.createQuery()
      .leftJoin('bed.unit', 'unit')
      .leftJoin('bed.kelas', 'kelas')
      .select([
        'bed.id',
        'bed.kode',
        'bed.nama',
        'bed.namaKamar',
        'bed.unitId',
        'bed.kelasId',
        'bed.isIsolasi',
        'bed.statusKetersediaan',
        'unit.id',
        'unit.kode',
        'unit.nama',
        'kelas.id',
        'kelas.kode',
        'kelas.nama',
      ])
      .andWhere('bed.status = :status', { status: 'Y' })
      .andWhere('bed.statusKetersediaan = :kosong', {
        kosong: StatusKetersediaanBed.KOSONG,
      })
      .andWhere('unit.status = :unitStatus', { unitStatus: 'Y' });

    if (unitId) {
      qb.andWhere('bed.unitId = :unitId', { unitId });
    }

    if (kelasId) {
      qb.andWhere('bed.kelasId = :kelasId', { kelasId });
    }

    return qb
      .orderBy('unit.nama', 'ASC')
      .addOrderBy('bed.namaKamar', 'ASC')
      .addOrderBy('bed.nama', 'ASC')
      .getMany();
  }

  /**
   * Ringkasan agregat ketersediaan tempat tidur per Unit dan Kelas (1 query agregasi, bebas N+1).
   */
  async getAvailabilitySummary() {
    const rawRows = await this.createQuery()
      .innerJoin('bed.unit', 'unit')
      .innerJoin('bed.kelas', 'kelas')
      .select('unit.id', 'unitId')
      .addSelect('unit.kode', 'unitKode')
      .addSelect('unit.nama', 'unitNama')
      .addSelect('kelas.id', 'kelasId')
      .addSelect('kelas.kode', 'kelasKode')
      .addSelect('kelas.nama', 'kelasNama')
      .addSelect('COUNT(bed.id)', 'totalBed')
      .addSelect(
        'SUM(CASE WHEN bed.statusKetersediaan = :kosong THEN 1 ELSE 0 END)',
        'kosong',
      )
      .addSelect(
        'SUM(CASE WHEN bed.statusKetersediaan = :terisi THEN 1 ELSE 0 END)',
        'terisi',
      )
      .addSelect(
        'SUM(CASE WHEN bed.statusKetersediaan = :booking THEN 1 ELSE 0 END)',
        'booking',
      )
      .addSelect(
        'SUM(CASE WHEN bed.statusKetersediaan = :pembersihan THEN 1 ELSE 0 END)',
        'pembersihan',
      )
      .addSelect(
        'SUM(CASE WHEN bed.statusKetersediaan = :perbaikan THEN 1 ELSE 0 END)',
        'perbaikan',
      )
      .andWhere('bed.status = :status', { status: 'Y' })
      .setParameters({
        kosong: StatusKetersediaanBed.KOSONG,
        terisi: StatusKetersediaanBed.TERISI,
        booking: StatusKetersediaanBed.BOOKING,
        pembersihan: StatusKetersediaanBed.PEMBERSIHAN,
        perbaikan: StatusKetersediaanBed.PERBAIKAN,
      })
      .groupBy('unit.id')
      .addGroupBy('unit.kode')
      .addGroupBy('unit.nama')
      .addGroupBy('kelas.id')
      .addGroupBy('kelas.kode')
      .addGroupBy('kelas.nama')
      .orderBy('unit.nama', 'ASC')
      .addOrderBy('kelas.nama', 'ASC')
      .getRawMany<BedSummaryRawRow>();

    return rawRows.map((row) => ({
      unitId: Number(row.unitId),
      unitKode: row.unitKode,
      unitNama: row.unitNama,
      kelasId: Number(row.kelasId),
      kelasKode: row.kelasKode,
      kelasNama: row.kelasNama,
      totalBed: Number(row.totalBed),
      kosong: Number(row.kosong),
      terisi: Number(row.terisi),
      booking: Number(row.booking),
      pembersihan: Number(row.pembersihan),
      perbaikan: Number(row.perbaikan),
    }));
  }

  async findOne(id: number): Promise<Bed> {
    const item = await this.createQuery()
      .leftJoinAndSelect('bed.unit', 'unit')
      .leftJoinAndSelect('bed.kelas', 'kelas')
      .andWhere('bed.id = :id', { id })
      .getOne();

    if (!item) {
      throw new NotFoundException(`Bed dengan ID #${id} tidak ditemukan.`);
    }
    return item;
  }

  async create(dto: CreateBedDto): Promise<Bed> {
    await this.validateBedReferences(
      dto.kode,
      dto.nama,
      dto.unitId,
      dto.kelasId,
      dto.namaKamar ?? null,
    );

    const entity = this.repo.create({
      ...dto,
      tenantId: this.tenantId,
    });

    const saved = await saveWithUniqueHandling(
      this.repo,
      entity,
      'Kode bed sudah terdaftar pada tenant ini.',
    );
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateBedDto): Promise<Bed> {
    const existing = await this.findOne(id);
    const targetUnitId = dto.unitId ?? existing.unitId;
    const targetKelasId = dto.kelasId ?? existing.kelasId;
    const targetKode = dto.kode ?? existing.kode;
    const targetNama = dto.nama ?? existing.nama;
    const targetNamaKamar =
      dto.namaKamar !== undefined ? dto.namaKamar : existing.namaKamar;

    await this.validateBedReferences(
      targetKode,
      targetNama,
      targetUnitId,
      targetKelasId,
      targetNamaKamar,
      id,
    );

    Object.assign(existing, dto);
    await saveWithUniqueHandling(
      this.repo,
      existing,
      'Kode bed sudah terdaftar pada tenant ini.',
    );
    return this.findOne(id);
  }

  async updateStatusKetersediaan(
    id: number,
    dto: UpdateStatusKetersediaanBedDto,
  ): Promise<Bed> {
    const existing = await this.findOne(id);
    existing.statusKetersediaan = dto.statusKetersediaan;
    if (dto.keterangan !== undefined) {
      existing.keterangan = dto.keterangan;
    }
    await this.repo.save(existing);
    return this.findOne(id);
  }

  async remove(id: number) {
    const existing = await this.findOne(id);
    if (existing.statusKetersediaan === String(StatusKetersediaanBed.TERISI)) {
      throw new ConflictException(
        'Bed yang sedang terisi pasien tidak dapat dihapus.',
      );
    }

    await removeWithFkHandling(
      this.repo,
      existing,
      'Data bed tidak dapat dihapus karena masih digunakan pada data rawat inap.',
    );
    return {
      message: `Data bed "${existing.kode}" (${existing.nama}) berhasil dihapus.`,
    };
  }

  private async validateBedReferences(
    kode: string,
    nama: string,
    unitId: number,
    kelasId: number,
    namaKamar: string | null,
    excludeId?: number,
  ): Promise<void> {
    const tenantId = this.tenantId;

    await assertUniqueTenantFields(
      this.repo,
      tenantId,
      [{ field: 'kode', value: kode, label: 'Kode bed' }],
      excludeId,
    );

    const [unit] = await Promise.all([
      assertActiveMasterRecord(this.unitRepo, unitId, tenantId, 'Unit', false),
      assertActiveMasterRecord(this.kelasRepo, kelasId, tenantId, 'Kelas'),
    ]);

    if (!unit.isTersediaBed) {
      throw new BadRequestException(
        `Unit "${unit.nama}" tidak dikonfigurasi untuk menampung tempat tidur (isTersediaBed = false).`,
      );
    }

    const dupBedInRoom = await this.repo.findOne({
      where: {
        tenantId,
        unitId,
        nama,
        namaKamar: namaKamar ? namaKamar : IsNull(),
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
      select: ['id'],
    });
    if (dupBedInRoom) {
      const lokasi = namaKamar ? `${unit.nama} - ${namaKamar}` : unit.nama;
      throw new ConflictException(
        `Bed "${nama}" sudah terdaftar pada ${lokasi}.`,
      );
    }
  }
}
