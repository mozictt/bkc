import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Unit } from '@entities/unit.entity';
import { Kelas } from '@entities/kelas.entity';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { BaseTenantService } from '@common/tenant/base-tenant.service';
import { JenisUnit } from '../../constants/simrs.enum';
import {
  assertActiveMasterRecord,
  assertUniqueTenantFields,
  removeWithFkHandling,
  saveWithUniqueHandling,
} from '../../helpers/master-entity.helper';
import { CreateUnitDto } from '../dto/create-unit.dto';
import { UpdateUnitDto } from '../dto/update-unit.dto';
import { QueryUnitDto } from '../dto/query-unit.dto';

const BED_CAPABLE_UNIT_TYPES = new Set<string>([
  JenisUnit.RAWAT_INAP,
  JenisUnit.IGD,
  JenisUnit.INTENSIVE,
  JenisUnit.OK,
]);

@Injectable()
export class UnitService extends BaseTenantService<Unit> {
  constructor(
    @InjectRepository(Unit)
    private readonly repo: Repository<Unit>,
    @InjectRepository(Kelas)
    private readonly kelasRepo: Repository<Kelas>,
    tenantService: TenantContextService,
  ) {
    super(repo, tenantService, 'unit');
  }

  async findAll(queryDto: QueryUnitDto) {
    const page = Math.max(1, queryDto.page ?? 1);
    const limit = Math.max(1, Math.min(100, queryDto.limit ?? 10));
    const {
      search,
      jenisUnit,
      isTersediaBed,
      status,
      sortBy = 'id',
      sortType = 'DESC',
    } = queryDto;

    const qb = this.createQuery()
      .leftJoin('unit.parent', 'parent')
      .leftJoin('unit.kelasDefault', 'kelasDefault')
      .select([
        'unit.id',
        'unit.kode',
        'unit.nama',
        'unit.jenisUnit',
        'unit.parentId',
        'unit.kelasDefaultId',
        'unit.gedung',
        'unit.lantai',
        'unit.noTeleponEkstensi',
        'unit.kodeBpjsPoli',
        'unit.ihsLocationId',
        'unit.isTersediaBed',
        'unit.status',
        'unit.createdAt',
        'parent.id',
        'parent.kode',
        'parent.nama',
        'kelasDefault.id',
        'kelasDefault.kode',
        'kelasDefault.nama',
      ]);

    if (search && search.trim()) {
      const term = `%${search.trim().toUpperCase()}%`;
      qb.andWhere(
        '(UPPER(unit.kode) LIKE :term OR UPPER(unit.nama) LIKE :term OR UPPER(unit.gedung) LIKE :term OR UPPER(unit.kodeBpjsPoli) LIKE :term)',
        { term },
      );
    }

    if (jenisUnit) {
      qb.andWhere('unit.jenisUnit = :jenisUnit', { jenisUnit });
    }

    if (isTersediaBed !== undefined) {
      qb.andWhere('unit.isTersediaBed = :isTersediaBed', { isTersediaBed });
    }

    if (status) {
      qb.andWhere('unit.status = :status', { status });
    }

    const allowedSort = ['id', 'kode', 'nama', 'jenisUnit', 'createdAt'];
    const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'id';
    const orderDirection = sortType === 'ASC' ? 'ASC' : 'DESC';

    const [items, totalItems] = await qb
      .orderBy(`unit.${orderColumn}`, orderDirection)
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

  async findOptions(
    search = '',
    jenisUnit?: JenisUnit,
    isTersediaBed?: boolean,
  ) {
    const qb = this.createQuery()
      .leftJoin('unit.kelasDefault', 'kelasDefault')
      .select([
        'unit.id',
        'unit.kode',
        'unit.nama',
        'unit.jenisUnit',
        'unit.parentId',
        'unit.kelasDefaultId',
        'unit.isTersediaBed',
        'kelasDefault.id',
        'kelasDefault.kode',
        'kelasDefault.nama',
      ])
      .andWhere('unit.status = :status', { status: 'Y' });

    if (jenisUnit) {
      qb.andWhere('unit.jenisUnit = :jenisUnit', { jenisUnit });
    }

    if (isTersediaBed !== undefined) {
      qb.andWhere('unit.isTersediaBed = :isTersediaBed', { isTersediaBed });
    }

    if (search.trim()) {
      const term = `%${search.trim().toUpperCase()}%`;
      qb.andWhere(
        '(UPPER(unit.kode) LIKE :term OR UPPER(unit.nama) LIKE :term)',
        { term },
      );
    }

    return qb.orderBy('unit.nama', 'ASC').getMany();
  }

  async findOne(id: number): Promise<Unit> {
    const item = await this.createQuery()
      .leftJoinAndSelect('unit.parent', 'parent')
      .leftJoinAndSelect('unit.kelasDefault', 'kelasDefault')
      .andWhere('unit.id = :id', { id })
      .getOne();

    if (!item) {
      throw new NotFoundException(`Unit dengan ID #${id} tidak ditemukan.`);
    }
    return item;
  }

  async create(dto: CreateUnitDto): Promise<Unit> {
    await this.validateUnitReferences(dto.kode, dto.nama, {
      parentId: dto.parentId,
      kelasDefaultId: dto.kelasDefaultId,
    });

    const entity = this.repo.create({
      ...dto,
      isTersediaBed:
        dto.isTersediaBed !== undefined
          ? dto.isTersediaBed
          : BED_CAPABLE_UNIT_TYPES.has(dto.jenisUnit),
      tenantId: this.tenantId,
    });

    const saved = await saveWithUniqueHandling(
      this.repo,
      entity,
      'Kode atau nama unit sudah terdaftar pada tenant ini.',
    );
    return this.findOne(saved.id);
  }

  async update(id: number, dto: UpdateUnitDto): Promise<Unit> {
    const existing = await this.findOne(id);

    await this.validateUnitReferences(
      dto.kode ?? existing.kode,
      dto.nama ?? existing.nama,
      {
        parentId: dto.parentId !== undefined ? dto.parentId : existing.parentId,
        kelasDefaultId:
          dto.kelasDefaultId !== undefined
            ? dto.kelasDefaultId
            : existing.kelasDefaultId,
      },
      id,
    );

    Object.assign(existing, dto);
    await saveWithUniqueHandling(
      this.repo,
      existing,
      'Kode atau nama unit sudah terdaftar pada tenant ini.',
    );
    return this.findOne(id);
  }

  async remove(id: number) {
    const existing = await this.findOne(id);
    await removeWithFkHandling(
      this.repo,
      existing,
      'Data unit tidak dapat dihapus karena masih memiliki sub-unit atau data bed.',
    );
    return {
      message: `Data unit "${existing.nama}" berhasil dihapus.`,
    };
  }

  private async validateUnitReferences(
    kode: string,
    nama: string,
    refs: {
      parentId?: number | null;
      kelasDefaultId?: number | null;
    },
    excludeId?: number,
  ): Promise<void> {
    const tenantId = this.tenantId;

    await assertUniqueTenantFields(
      this.repo,
      tenantId,
      [
        { field: 'kode', value: kode, label: 'Kode unit' },
        { field: 'nama', value: nama, label: 'Nama unit' },
      ],
      excludeId,
    );

    if (refs.kelasDefaultId !== undefined && refs.kelasDefaultId !== null) {
      await assertActiveMasterRecord(
        this.kelasRepo,
        refs.kelasDefaultId,
        tenantId,
        'Kelas default',
      );
    }

    if (refs.parentId !== undefined && refs.parentId !== null) {
      if (excludeId && refs.parentId === excludeId) {
        throw new BadRequestException(
          'Unit tidak boleh menjadi induk bagi dirinya sendiri.',
        );
      }

      await assertActiveMasterRecord(
        this.repo,
        refs.parentId,
        tenantId,
        'Unit induk',
        false,
      );

      if (excludeId) {
        await this.assertNoParentCycle(excludeId, refs.parentId, tenantId);
      }
    }
  }

  private async assertNoParentCycle(
    unitId: number,
    candidateParentId: number,
    tenantId: string,
  ): Promise<void> {
    const visited = new Set<number>([unitId]);
    let currentId: number | null = candidateParentId;

    for (let depth = 0; depth < 20 && currentId !== null; depth += 1) {
      if (visited.has(currentId)) {
        throw new BadRequestException(
          'Hierarki unit induk membentuk siklus (circular reference).',
        );
      }
      visited.add(currentId);
      const ancestor = await this.repo.findOne({
        where: { id: currentId, tenantId },
        select: ['id', 'parentId'],
      });
      currentId = ancestor?.parentId ?? null;
    }
  }
}
