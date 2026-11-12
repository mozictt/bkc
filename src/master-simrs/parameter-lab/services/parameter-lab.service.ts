import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { LabParameter } from '@entities/lab-parameter.entity';
import { LabParameterRujukan } from '@entities/lab-parameter-rujukan.entity';
import { LabTindakanParameter } from '@entities/lab-tindakan-parameter.entity';
import { TarifTindakan } from '@entities/tarif-tindakan.entity';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { BaseTenantService } from '@common/tenant/base-tenant.service';
import { JenisTarif, TipeHasilLab } from '../../constants/simrs.enum';
import {
  assertActiveMasterRecord,
  assertUniqueTenantFields,
  removeWithFkHandling,
  saveWithUniqueHandling,
} from '../../helpers/master-entity.helper';
import {
  CreateLabParameterDto,
  CreateLabRujukanDto,
  QueryLabParameterDto,
  QuickAddParameterToTindakanDto,
  SaveTindakanParameterMappingDto,
  UpdateLabParameterDto,
} from '../dto/parameter-lab.dto';

interface ParamCountRawRow {
  parameterId: string | number;
  jumlahTindakan: string;
}

interface TindakanParamCountRawRow {
  tindakanId: string | number;
  jumlahParameter: string;
}

@Injectable()
export class ParameterLabService extends BaseTenantService<LabParameter> {
  constructor(
    @InjectRepository(LabParameter)
    private readonly repo: Repository<LabParameter>,
    @InjectRepository(LabParameterRujukan)
    private readonly rujukanRepo: Repository<LabParameterRujukan>,
    @InjectRepository(LabTindakanParameter)
    private readonly mappingRepo: Repository<LabTindakanParameter>,
    @InjectRepository(TarifTindakan)
    private readonly tindakanRepo: Repository<TarifTindakan>,
    private readonly dataSource: DataSource,
    tenantService: TenantContextService,
  ) {
    super(repo, tenantService, 'labParameter');
  }

  async findAll(queryDto: QueryLabParameterDto) {
    const page = Math.max(1, Number(queryDto.page ?? 1) || 1);
    const limit = Math.max(1, Math.min(100, Number(queryDto.limit ?? 20) || 20));
    const {
      search,
      grup,
      tipeHasil,
      status,
      sortBy = 'urutanDefault',
      sortType = 'ASC',
    } = queryDto;

    const qb = this.createQuery();

    if (search && search.trim()) {
      const term = `%${search.trim().toUpperCase()}%`;
      qb.andWhere(
        `(UPPER(labParameter.kode) LIKE :term OR UPPER(labParameter.nama) LIKE :term OR UPPER(COALESCE(labParameter.grup, '')) LIKE :term OR UPPER(COALESCE(labParameter.loincCode, '')) LIKE :term)`,
        { term },
      );
    }

    if (grup && grup.trim()) {
      qb.andWhere('UPPER(COALESCE(labParameter.grup, \'\')) = :grup', {
        grup: grup.trim().toUpperCase(),
      });
    }

    if (tipeHasil) {
      qb.andWhere('labParameter.tipeHasil = :tipeHasil', { tipeHasil });
    }

    if (status) {
      qb.andWhere('labParameter.status = :status', { status });
    }

    const allowedSort = [
      'id',
      'kode',
      'nama',
      'grup',
      'urutanDefault',
      'createdAt',
    ];
    const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'urutanDefault';
    const orderDirection = sortType === 'DESC' ? 'DESC' : 'ASC';

    const [rows, totalItems] = await qb
      .orderBy(`labParameter.${orderColumn}`, orderDirection)
      .addOrderBy('labParameter.id', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const paramIds = rows.map((row) => row.id);
    const [rujukanMap, countMap] = await Promise.all([
      this.fetchRujukanMapByParamIds(paramIds),
      this.fetchTindakanCountMapByParamIds(paramIds),
    ]);

    const items = rows.map((row) => ({
      ...row,
      rujukanList: rujukanMap.get(row.id) ?? [],
      jumlahTindakan: countMap.get(row.id) ?? 0,
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

  async findOptions(search = '', grup = '') {
    const qb = this.createQuery()
      .andWhere('labParameter.status = :status', { status: 'Y' });

    if (grup.trim()) {
      qb.andWhere('UPPER(COALESCE(labParameter.grup, \'\')) = :grup', {
        grup: grup.trim().toUpperCase(),
      });
    }

    if (search.trim()) {
      const term = `%${search.trim().toUpperCase()}%`;
      qb.andWhere(
        '(UPPER(labParameter.kode) LIKE :term OR UPPER(labParameter.nama) LIKE :term OR UPPER(COALESCE(labParameter.grup, \'\')) LIKE :term)',
        { term },
      );
    }

    const rows = await qb
      .orderBy('labParameter.urutanDefault', 'ASC')
      .addOrderBy('labParameter.nama', 'ASC')
      .limit(100)
      .getMany();

    const rujukanMap = await this.fetchRujukanMapByParamIds(
      rows.map((r) => r.id),
    );

    return rows.map((row) => ({
      ...row,
      rujukanList: rujukanMap.get(row.id) ?? [],
    }));
  }

  async findOne(id: number) {
    const param = await this.repo.findOne({
      where: { id, tenantId: this.tenantId },
    });
    if (!param) {
      throw new NotFoundException(
        `Parameter lab dengan ID #${id} tidak ditemukan.`,
      );
    }

    const rujukanList = await this.rujukanRepo.find({
      where: { parameterId: id, tenantId: this.tenantId },
      order: { jenisKelamin: 'ASC', usiaMinHari: 'ASC', id: 'ASC' },
    });

    return {
      ...param,
      rujukanList,
    };
  }

  async create(dto: CreateLabParameterDto) {
    const tenantId = this.tenantId;
    await assertUniqueTenantFields(this.repo, tenantId, [
      { field: 'kode', value: dto.kode, label: 'Kode parameter lab' },
      { field: 'nama', value: dto.nama, label: 'Nama parameter lab' },
    ]);

    const savedId = await this.dataSource.transaction(async (manager) => {
      const created = await this.createParameterInTx(manager, tenantId, dto);
      return created.id;
    });

    return this.findOne(savedId);
  }

  async update(id: number, dto: UpdateLabParameterDto) {
    const tenantId = this.tenantId;
    const existing = await this.repo.findOne({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException(
        `Parameter lab dengan ID #${id} tidak ditemukan.`,
      );
    }

    await assertUniqueTenantFields(
      this.repo,
      tenantId,
      [
        {
          field: 'kode',
          value: dto.kode ?? existing.kode,
          label: 'Kode parameter lab',
        },
        {
          field: 'nama',
          value: dto.nama ?? existing.nama,
          label: 'Nama parameter lab',
        },
      ],
      id,
    );

    const { rujukanList, opsiPilihan, ...rest } = dto;
    const nextTipe = rest.tipeHasil ?? existing.tipeHasil;
    const sanitizedOptions = this.sanitizeOpsiPilihan(
      nextTipe,
      opsiPilihan !== undefined ? opsiPilihan : existing.opsiPilihan,
    );

    await this.dataSource.transaction(async (manager) => {
      const pRepo = manager.getRepository(LabParameter);
      const rRepo = manager.getRepository(LabParameterRujukan);

      Object.assign(existing, rest);
      existing.opsiPilihan = sanitizedOptions;

      await saveWithUniqueHandling(
        pRepo,
        existing,
        'Kode atau nama parameter lab sudah digunakan pada tenant ini.',
      );

      if (rujukanList !== undefined) {
        await rRepo.delete({ parameterId: id, tenantId });
        if (rujukanList.length > 0) {
          const newRows = this.buildRujukanEntities(
            rRepo,
            tenantId,
            id,
            rujukanList,
          );
          await rRepo.save(newRows);
        }
      }
    });

    return this.findOne(id);
  }

  async remove(id: number) {
    const existing = await this.repo.findOne({
      where: { id, tenantId: this.tenantId },
    });
    if (!existing) {
      throw new NotFoundException(
        `Parameter lab dengan ID #${id} tidak ditemukan.`,
      );
    }

    await removeWithFkHandling(
      this.repo,
      existing,
      'Parameter lab tidak dapat dihapus karena masih digunakan pada hasil pemeriksaan pasien.',
    );

    return { message: `Parameter lab "${existing.nama}" berhasil dihapus.` };
  }

  async getLabTindakanOverview(search = '') {
    const tenantId = this.tenantId;
    const qb = this.tindakanRepo
      .createQueryBuilder('tt')
      .where('tt.tenantId = :tenantId', { tenantId })
      .andWhere('tt.jenisTarif = :jenisTarif', {
        jenisTarif: JenisTarif.LABORATORIUM,
      });

    if (search.trim()) {
      const term = `%${search.trim().toUpperCase()}%`;
      qb.andWhere(
        `(UPPER(tt.kode) LIKE :term OR UPPER(tt.nama) LIKE :term OR UPPER(COALESCE(tt.kelompokTarif, '')) LIKE :term)`,
        { term },
      );
    }

    const actions = await qb.orderBy('tt.nama', 'ASC').getMany();
    if (actions.length === 0) return [];

    const ids = actions.map((item) => item.id);
    const rawCounts = await this.mappingRepo
      .createQueryBuilder('m')
      .select('m.tindakanId', 'tindakanId')
      .addSelect('COUNT(m.id)', 'jumlahParameter')
      .where('m.tenantId = :tenantId', { tenantId })
      .andWhere('m.tindakanId IN (:...ids)', { ids })
      .groupBy('m.tindakanId')
      .getRawMany<TindakanParamCountRawRow>();

    const countMap = new Map<number, number>();
    for (const row of rawCounts) {
      countMap.set(Number(row.tindakanId), Number(row.jumlahParameter || 0));
    }

    return actions.map((action) => ({
      ...action,
      jumlahParameter: countMap.get(action.id) ?? 0,
    }));
  }

  async getMappingByTindakan(tindakanId: number) {
    const tenantId = this.tenantId;
    const tindakan = await this.assertLabTindakan(tindakanId, tenantId);

    const mappings = await this.mappingRepo
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.parameter', 'param')
      .where('m.tenantId = :tenantId', { tenantId })
      .andWhere('m.tindakanId = :tindakanId', { tindakanId })
      .orderBy('m.urutan', 'ASC')
      .addOrderBy('m.id', 'ASC')
      .getMany();

    const rujukanMap = await this.fetchRujukanMapByParamIds(
      mappings.map((m) => m.parameterId),
    );

    return {
      tindakan,
      items: mappings.map((m) => ({
        id: m.id,
        tindakanId: m.tindakanId,
        parameterId: m.parameterId,
        urutan: m.urutan,
        subGrupLabel: m.subGrupLabel,
        isWajib: m.isWajib,
        parameter: {
          ...m.parameter,
          rujukanList: rujukanMap.get(m.parameterId) ?? [],
        },
      })),
    };
  }

  async saveMappingForTindakan(
    tindakanId: number,
    dto: SaveTindakanParameterMappingDto,
  ) {
    const tenantId = this.tenantId;
    await this.assertLabTindakan(tindakanId, tenantId);

    const seenParamIds = new Set<number>();
    for (const item of dto.items) {
      if (seenParamIds.has(item.parameterId)) {
        throw new BadRequestException(
          `Parameter dengan ID #${item.parameterId} terduplikasi dalam satu panel tindakan.`,
        );
      }
      seenParamIds.add(item.parameterId);
    }

    if (seenParamIds.size > 0) {
      const targetIds = Array.from(seenParamIds);
      const validParams = await this.repo.find({
        where: { id: In(targetIds), tenantId },
        select: ['id', 'status', 'nama'],
      });
      if (validParams.length !== targetIds.length) {
        throw new BadRequestException(
          'Sebagian parameter lab tidak ditemukan pada tenant ini.',
        );
      }
    }

    await this.dataSource.transaction(async (manager) => {
      const mRepo = manager.getRepository(LabTindakanParameter);
      await mRepo.delete({ tindakanId, tenantId });

      if (dto.items.length > 0) {
        const rows = dto.items.map((item, idx) =>
          mRepo.create({
            tenantId,
            tindakanId,
            parameterId: item.parameterId,
            urutan: item.urutan ?? idx + 1,
            subGrupLabel: item.subGrupLabel?.trim() || null,
            isWajib: item.isWajib ?? true,
          }),
        );
        await mRepo.save(rows);
      }
    });

    return this.getMappingByTindakan(tindakanId);
  }

  async quickAddToTindakan(
    tindakanId: number,
    dto: QuickAddParameterToTindakanDto,
  ) {
    const tenantId = this.tenantId;
    await this.assertLabTindakan(tindakanId, tenantId);

    await assertUniqueTenantFields(this.repo, tenantId, [
      { field: 'kode', value: dto.kode, label: 'Kode parameter lab' },
      { field: 'nama', value: dto.nama, label: 'Nama parameter lab' },
    ]);

    const { subGrupLabel, isWajib, ...paramDto } = dto;

    await this.dataSource.transaction(async (manager) => {
      const createdParam = await this.createParameterInTx(
        manager,
        tenantId,
        paramDto,
      );

      const mRepo = manager.getRepository(LabTindakanParameter);
      const currentRows = await mRepo.find({
        where: { tindakanId, tenantId },
        select: ['urutan'],
      });
      const maxUrutan = currentRows.reduce(
        (maxVal, row) => Math.max(maxVal, Number(row.urutan || 0)),
        0,
      );

      const mapping = mRepo.create({
        tenantId,
        tindakanId,
        parameterId: createdParam.id,
        urutan: maxUrutan + 1,
        subGrupLabel: subGrupLabel?.trim() || createdParam.grup || null,
        isWajib: isWajib ?? true,
      });

      await mRepo.save(mapping);
    });

    return this.getMappingByTindakan(tindakanId);
  }

  private async createParameterInTx(
    manager: EntityManager,
    tenantId: string,
    dto: CreateLabParameterDto,
  ) {
    const pRepo = manager.getRepository(LabParameter);
    const rRepo = manager.getRepository(LabParameterRujukan);

    const { rujukanList, opsiPilihan, ...rest } = dto;
    const tipeHasil = rest.tipeHasil ?? TipeHasilLab.NUMERIC;
    const entity = pRepo.create({
      ...rest,
      tenantId,
      tipeHasil,
      opsiPilihan: this.sanitizeOpsiPilihan(tipeHasil, opsiPilihan),
    });

    const created = await saveWithUniqueHandling(
      pRepo,
      entity,
      'Kode atau nama parameter lab sudah digunakan pada tenant ini.',
    );

    if (rujukanList && rujukanList.length > 0) {
      const rows = this.buildRujukanEntities(
        rRepo,
        tenantId,
        created.id,
        rujukanList,
      );
      await rRepo.save(rows);
    }

    return created;
  }

  private sanitizeOpsiPilihan(
    tipeHasil: string,
    rawOptions?: string[] | null,
  ): string[] | null {
    if (tipeHasil !== TipeHasilLab.OPTION) return null;
    if (!rawOptions || rawOptions.length === 0) {
      throw new BadRequestException(
        'Opsi pilihan wajib diisi apabila tipe hasil adalah OPTION.',
      );
    }
    const cleaned = Array.from(
      new Set(rawOptions.map((item) => item.trim()).filter(Boolean)),
    );
    if (cleaned.length === 0) {
      throw new BadRequestException(
        'Minimal harus ada 1 opsi pilihan untuk tipe hasil OPTION.',
      );
    }
    return cleaned;
  }

  private buildRujukanEntities(
    rRepo: Repository<LabParameterRujukan>,
    tenantId: string,
    parameterId: number,
    list: CreateLabRujukanDto[],
  ): LabParameterRujukan[] {
    return list.map((item) => {
      const minHari = Math.max(0, Math.floor(Number(item.usiaMinHari ?? 0)));
      const maxHari = Math.max(0, Math.floor(Number(item.usiaMaxHari ?? 99999)));
      if (maxHari < minHari) {
        throw new BadRequestException(
          'Usia maksimum rujukan tidak boleh lebih kecil dari usia minimum.',
        );
      }
      if (
        item.nilaiMin !== undefined &&
        item.nilaiMin !== null &&
        item.nilaiMax !== undefined &&
        item.nilaiMax !== null &&
        Number(item.nilaiMax) < Number(item.nilaiMin)
      ) {
        throw new BadRequestException(
          'Nilai normal maksimum tidak boleh lebih kecil dari nilai normal minimum.',
        );
      }

      return rRepo.create({
        tenantId,
        parameterId,
        jenisKelamin: item.jenisKelamin ?? 'ALL',
        usiaMinHari: minHari,
        usiaMaxHari: maxHari,
        labelUsia: item.labelUsia?.trim() || null,
        nilaiMin:
          item.nilaiMin !== undefined && item.nilaiMin !== null
            ? Number(item.nilaiMin).toFixed(4)
            : null,
        nilaiMax:
          item.nilaiMax !== undefined && item.nilaiMax !== null
            ? Number(item.nilaiMax).toFixed(4)
            : null,
        kritisMin:
          item.kritisMin !== undefined && item.kritisMin !== null
            ? Number(item.kritisMin).toFixed(4)
            : null,
        kritisMax:
          item.kritisMax !== undefined && item.kritisMax !== null
            ? Number(item.kritisMax).toFixed(4)
            : null,
        nilaiNormalText: item.nilaiNormalText?.trim() || null,
        keterangan: item.keterangan?.trim() || null,
      });
    });
  }

  private async assertLabTindakan(tindakanId: number, tenantId: string) {
    const tindakan = await assertActiveMasterRecord(
      this.tindakanRepo,
      tindakanId,
      tenantId,
      'Master tarif tindakan',
      false,
    );
    if (tindakan.jenisTarif !== JenisTarif.LABORATORIUM) {
      throw new BadRequestException(
        `Tindakan "${tindakan.nama}" bukan kategori LABORATORIUM.`,
      );
    }
    return tindakan;
  }

  private async fetchRujukanMapByParamIds(parameterIds: number[]) {
    const result = new Map<number, LabParameterRujukan[]>();
    if (parameterIds.length === 0) return result;

    const rows = await this.rujukanRepo.find({
      where: { parameterId: In(parameterIds), tenantId: this.tenantId },
      order: { jenisKelamin: 'ASC', usiaMinHari: 'ASC', id: 'ASC' },
    });

    for (const row of rows) {
      const bucket = result.get(row.parameterId);
      if (bucket) {
        bucket.push(row);
      } else {
        result.set(row.parameterId, [row]);
      }
    }

    return result;
  }

  private async fetchTindakanCountMapByParamIds(parameterIds: number[]) {
    const result = new Map<number, number>();
    if (parameterIds.length === 0) return result;

    const rows = await this.mappingRepo
      .createQueryBuilder('m')
      .select('m.parameterId', 'parameterId')
      .addSelect('COUNT(m.id)', 'jumlahTindakan')
      .where('m.tenantId = :tenantId', { tenantId: this.tenantId })
      .andWhere('m.parameterId IN (:...parameterIds)', { parameterIds })
      .groupBy('m.parameterId')
      .getRawMany<ParamCountRawRow>();

    for (const row of rows) {
      result.set(Number(row.parameterId), Number(row.jumlahTindakan || 0));
    }
    return result;
  }
}
