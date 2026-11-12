import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { PenunjangLab } from '@entities/penunjang-lab.entity';
import { PenunjangLabItem } from '@entities/penunjang-lab-item.entity';
import { PenunjangLabHasil } from '@entities/penunjang-lab-hasil.entity';
import { Pendaftaran } from '@entities/pendaftaran.entity';
import { Unit } from '@entities/unit.entity';
import { Dokter } from '@entities/dokter.entity';
import { Pegawai } from '@entities/pegawai.entity';
import { TarifTindakan } from '@entities/tarif-tindakan.entity';
import { TarifLayanan } from '@entities/tarif-layanan.entity';
import { LabTindakanParameter } from '@entities/lab-tindakan-parameter.entity';
import { LabParameterRujukan } from '@entities/lab-parameter-rujukan.entity';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { BaseTenantService } from '@common/tenant/base-tenant.service';
import {
  JenisTarif,
  StatusAktifMaster,
  StatusAktifPegawai,
  StatusPenunjangLab,
  TipeHasilLab,
} from '@src/master-simrs/constants/simrs.enum';
import {
  assertActiveMasterRecord,
  formatNamaGelarDokter,
} from '@src/master-simrs/helpers/master-entity.helper';
import {
  getTodayIsoDate,
  parseNumericMoney,
  resolveBestTarifRule,
} from '@src/master-simrs/tarif/helpers/tarif.helper';
import {
  evaluateHasilLab,
  formatRujukanDisplay,
  resolveRujukanPasien,
} from '@src/master-simrs/parameter-lab/helpers/lab-parameter.helper';
import {
  ACTIVE_KUNJUNGAN_STATUSES,
  ELIGIBLE_UNPAID_PEMBAYARAN_STATUSES,
  StatusKunjungan,
} from '@src/transaksi/pendaftaran/constants/pendaftaran.enum';
import {
  assertPendaftaranEligibleForLab,
  generateNoLabAtomic,
} from '../helpers/penunjang-lab.helper';
import {
  BatalPenunjangLabDto,
  CreatePenunjangLabDto,
  PreviewTindakanLabDto,
  QueryEligibleKunjunganDto,
  QueryPenunjangLabDto,
  SaveHasilPenunjangLabDto,
  VerifyPenunjangLabDto,
} from '../dto/penunjang-lab.dto';

interface PendaftaranLabCountRaw {
  pendaftaranId: string | number;
  jumlahOrderLab: string;
}

interface LabHeaderStatsRaw {
  penunjangLabId: string | number;
  jumlahItem: string;
  jumlahParameter: string;
  jumlahTerisi: string;
  jumlahAbnormal: string;
  jumlahKritis: string;
}

interface BuiltPreviewTindakan {
  tindakan: TarifTindakan;
  resolvedTarif: ReturnType<typeof resolveBestTarifRule>;
  parameters: Array<{
    parameterId: number | null;
    kode: string;
    nama: string;
    grup: string | null;
    satuan: string | null;
    tipeHasil: string;
    opsiPilihan: string[] | null;
    desimal: number;
    isWajib: boolean;
    urutan: number;
    isStandaloneDirect?: boolean;
    rujukan: {
      id: number | null;
      jenisKelamin: string;
      labelUsia: string | null;
      nilaiMin: number | null;
      nilaiMax: number | null;
      kritisMin: number | null;
      kritisMax: number | null;
      nilaiNormalText: string | null;
      displayText: string;
    } | null;
  }>;
}

@Injectable()
export class PenunjangLabService extends BaseTenantService<PenunjangLab> {
  constructor(
    @InjectRepository(PenunjangLab)
    private readonly repo: Repository<PenunjangLab>,
    @InjectRepository(PenunjangLabItem)
    private readonly itemRepo: Repository<PenunjangLabItem>,
    @InjectRepository(PenunjangLabHasil)
    private readonly hasilRepo: Repository<PenunjangLabHasil>,
    @InjectRepository(Pendaftaran)
    private readonly pendaftaranRepo: Repository<Pendaftaran>,
    @InjectRepository(Unit)
    private readonly unitRepo: Repository<Unit>,
    @InjectRepository(Dokter)
    private readonly dokterRepo: Repository<Dokter>,
    @InjectRepository(Pegawai)
    private readonly pegawaiRepo: Repository<Pegawai>,
    @InjectRepository(TarifTindakan)
    private readonly tindakanRepo: Repository<TarifTindakan>,
    @InjectRepository(TarifLayanan)
    private readonly hargaRepo: Repository<TarifLayanan>,
    @InjectRepository(LabTindakanParameter)
    private readonly mappingRepo: Repository<LabTindakanParameter>,
    @InjectRepository(LabParameterRujukan)
    private readonly rujukanRepo: Repository<LabParameterRujukan>,
    private readonly dataSource: DataSource,
    tenantService: TenantContextService,
  ) {
    super(repo, tenantService, 'penunjangLab');
  }

  /**
   * Daftar pasien kunjungan yang masih aktif diperiksa atau belum lunas dibayar.
   */
  async findEligibleKunjungan(queryDto: QueryEligibleKunjunganDto) {
    const tenantId = this.tenantId;
    const page = Math.max(1, Number(queryDto.page ?? 1) || 1);
    const limit = Math.max(1, Math.min(100, Number(queryDto.limit ?? 10) || 10));
    const {
      search,
      tanggalDari,
      tanggalSampai,
      filterEligible = 'ALL',
      unitId,
    } = queryDto;

    const qb = this.pendaftaranRepo
      .createQueryBuilder('pendaftaran')
      .leftJoin('pendaftaran.pasien', 'pasien')
      .leftJoin('pasien.penduduk', 'penduduk')
      .leftJoin('pendaftaran.unitSaatIni', 'unitSaatIni')
      .leftJoin('pendaftaran.dokterSaatIni', 'dokterSaatIni')
      .leftJoin('dokterSaatIni.penduduk', 'dokterPenduduk')
      .leftJoin('pendaftaran.kelasSaatIni', 'kelasSaatIni')
      .leftJoin('pendaftaran.penjamin', 'penjamin')
      .select([
        'pendaftaran.id',
        'pendaftaran.noRegistrasi',
        'pendaftaran.pasienId',
        'pendaftaran.tanggalKunjungan',
        'pendaftaran.waktuDaftar',
        'pendaftaran.jenisLayananSaatIni',
        'pendaftaran.unitSaatIniId',
        'pendaftaran.dokterSaatIniId',
        'pendaftaran.kelasSaatIniId',
        'pendaftaran.jenisPenjamin',
        'pendaftaran.penjaminId',
        'pendaftaran.namaPenjaminSnapshot',
        'pendaftaran.statusKunjungan',
        'pendaftaran.statusPembayaran',
        'pasien.id',
        'pasien.noRm',
        'penduduk.id',
        'penduduk.nik',
        'penduduk.namaLengkap',
        'penduduk.tanggalLahir',
        'penduduk.jenisKelamin',
        'unitSaatIni.id',
        'unitSaatIni.kode',
        'unitSaatIni.nama',
        'dokterSaatIni.id',
        'dokterSaatIni.gelarDepan',
        'dokterSaatIni.gelarBelakang',
        'dokterPenduduk.namaLengkap',
        'kelasSaatIni.id',
        'kelasSaatIni.kode',
        'kelasSaatIni.nama',
        'penjamin.id',
        'penjamin.kode',
        'penjamin.nama',
      ])
      .where('pendaftaran.tenantId = :tenantId', { tenantId })
      .andWhere('pendaftaran.statusKunjungan != :batalStatus', {
        batalStatus: StatusKunjungan.BATAL,
      });

    if (filterEligible === 'DIPERIKSA') {
      qb.andWhere('pendaftaran.statusKunjungan IN (:...activeStatuses)', {
        activeStatuses: [...ACTIVE_KUNJUNGAN_STATUSES],
      });
    } else if (filterEligible === 'BELUM_BAYAR') {
      qb.andWhere('pendaftaran.statusPembayaran IN (:...unpaidStatuses)', {
        unpaidStatuses: [...ELIGIBLE_UNPAID_PEMBAYARAN_STATUSES],
      });
    } else {
      qb.andWhere(
        '(pendaftaran.statusKunjungan IN (:...activeStatuses) OR pendaftaran.statusPembayaran IN (:...unpaidStatuses))',
        {
          activeStatuses: [...ACTIVE_KUNJUNGAN_STATUSES],
          unpaidStatuses: [...ELIGIBLE_UNPAID_PEMBAYARAN_STATUSES],
        },
      );
    }

    if (search && search.trim()) {
      const term = `%${search.trim().toUpperCase()}%`;
      qb.andWhere(
        `(UPPER(pendaftaran.noRegistrasi) LIKE :term OR UPPER(pasien.noRm) LIKE :term OR UPPER(penduduk.namaLengkap) LIKE :term OR COALESCE(penduduk.nik, '') LIKE :exactTerm)`,
        { term, exactTerm: `%${search.trim()}%` },
      );
    }

    if (tanggalDari) {
      qb.andWhere('pendaftaran.tanggalKunjungan >= :tanggalDari', {
        tanggalDari,
      });
    }

    if (tanggalSampai) {
      qb.andWhere('pendaftaran.tanggalKunjungan <= :tanggalSampai', {
        tanggalSampai,
      });
    }

    if (unitId) {
      qb.andWhere('pendaftaran.unitSaatIniId = :unitId', { unitId });
    }

    const [rows, totalItems] = await qb
      .orderBy('pendaftaran.waktuDaftar', 'DESC')
      .addOrderBy('pendaftaran.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const labCountMap = await this.fetchLabCountByPendaftaranIds(
      rows.map((r) => r.id),
    );

    const items = rows.map((row) => ({
      ...row,
      dokterSaatIni: row.dokterSaatIni
        ? {
            ...row.dokterSaatIni,
            namaLengkapGelar: formatNamaGelarDokter(
              row.dokterSaatIni.gelarDepan,
              row.dokterSaatIni.penduduk?.namaLengkap,
              row.dokterSaatIni.gelarBelakang,
            ),
          }
        : null,
      jumlahOrderLab: labCountMap.get(row.id) ?? 0,
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

  /**
   * Preview tarif (Unit -> Penjamin -> Kelas) + susunan parameter & rujukan pasien sebelum disimpan.
   */
  async previewTindakanForKunjungan(queryDto: PreviewTindakanLabDto) {
    const tenantId = this.tenantId;
    const pendaftaran = await this.loadPendaftaranContext(
      queryDto.pendaftaranId,
      tenantId,
    );
    assertPendaftaranEligibleForLab(pendaftaran);

    if (queryDto.unitLabId) {
      await assertActiveMasterRecord(
        this.unitRepo,
        queryDto.unitLabId,
        tenantId,
        'Unit Laboratorium',
      );
    }

    const builtList = await this.buildPreviewItems({
      tenantId,
      pendaftaran,
      tindakanIds: queryDto.tindakanIds,
      unitLabId: queryDto.unitLabId ?? null,
    });

    const summaryTotals = builtList.reduce(
      (acc, entry) => {
        const rincian = entry.resolvedTarif.rincian;
        if (rincian) {
          acc.totalTarif += rincian.totalTarif;
          acc.totalJasaDokter += rincian.jasaDokter;
          acc.totalJasaNakes += rincian.jasaNakes;
        }
        return acc;
      },
      { totalTarif: 0, totalJasaDokter: 0, totalJasaNakes: 0 },
    );

    return {
      pendaftaran: {
        id: pendaftaran.id,
        noRegistrasi: pendaftaran.noRegistrasi,
        statusKunjungan: pendaftaran.statusKunjungan,
        statusPembayaran: pendaftaran.statusPembayaran,
        kelasSaatIniId: pendaftaran.kelasSaatIniId,
        penjaminId: pendaftaran.penjaminId,
        namaPenjaminSnapshot: pendaftaran.namaPenjaminSnapshot,
        pasien: pendaftaran.pasien,
      },
      ...summaryTotals,
      items: builtList.map((entry) => ({
        tindakan: {
          id: entry.tindakan.id,
          kode: entry.tindakan.kode,
          nama: entry.tindakan.nama,
          satuan: entry.tindakan.satuan,
          kelompokTarif: entry.tindakan.kelompokTarif,
          atributKhusus: entry.tindakan.atributKhusus,
        },
        tarifResolved: entry.resolvedTarif.found,
        tarifLayananId: entry.resolvedTarif.rule?.id ?? null,
        skorKecocokan: entry.resolvedTarif.skorKecocokan,
        keteranganTarif: entry.resolvedTarif.keteranganKecocokan,
        rincianTarif: entry.resolvedTarif.rincian ?? {
          jasaSarana: 0,
          bhp: 0,
          jasaDokter: 0,
          jasaNakes: 0,
          totalTarif: 0,
        },
        parameters: entry.parameters,
      })),
    };
  }

  async findAll(queryDto: QueryPenunjangLabDto) {
    const tenantId = this.tenantId;
    const page = Math.max(1, Number(queryDto.page ?? 1) || 1);
    const limit = Math.max(1, Math.min(100, Number(queryDto.limit ?? 10) || 10));
    const {
      search,
      tanggalDari,
      tanggalSampai,
      statusLab,
      pendaftaranId,
      isCito,
      sortBy = 'waktuOrder',
      sortType = 'DESC',
    } = queryDto;

    const qb = this.createQuery()
      .leftJoin('penunjangLab.pendaftaran', 'pendaftaran')
      .leftJoin('penunjangLab.pasien', 'pasien')
      .leftJoin('pasien.penduduk', 'penduduk')
      .leftJoin('penunjangLab.unitPengirim', 'unitPengirim')
      .leftJoin('penunjangLab.unitLab', 'unitLab')
      .leftJoin('penunjangLab.dokterPengirim', 'dokterPengirim')
      .leftJoin('dokterPengirim.penduduk', 'dokterPengirimPenduduk')
      .leftJoin('penunjangLab.dokterLab', 'dokterLab')
      .leftJoin('dokterLab.penduduk', 'dokterLabPenduduk')
      .leftJoin('penunjangLab.petugasLab', 'petugasLab')
      .select([
        'penunjangLab',
        'pendaftaran.id',
        'pendaftaran.noRegistrasi',
        'pendaftaran.statusKunjungan',
        'pendaftaran.statusPembayaran',
        'pendaftaran.namaPenjaminSnapshot',
        'pasien.id',
        'pasien.noRm',
        'penduduk.id',
        'penduduk.namaLengkap',
        'penduduk.jenisKelamin',
        'penduduk.tanggalLahir',
        'unitPengirim.id',
        'unitPengirim.nama',
        'unitLab.id',
        'unitLab.nama',
        'dokterPengirim.id',
        'dokterPengirim.gelarDepan',
        'dokterPengirim.gelarBelakang',
        'dokterPengirimPenduduk.namaLengkap',
        'dokterLab.id',
        'dokterLab.gelarDepan',
        'dokterLab.gelarBelakang',
        'dokterLabPenduduk.namaLengkap',
        'petugasLab.id',
        'petugasLab.name',
      ]);

    if (search && search.trim()) {
      const term = `%${search.trim().toUpperCase()}%`;
      qb.andWhere(
        `(UPPER(penunjangLab.noLab) LIKE :term OR UPPER(pendaftaran.noRegistrasi) LIKE :term OR UPPER(pasien.noRm) LIKE :term OR UPPER(penduduk.namaLengkap) LIKE :term)`,
        { term },
      );
    }

    if (tanggalDari) {
      qb.andWhere('DATE(penunjangLab.waktuOrder) >= :tanggalDari', {
        tanggalDari,
      });
    }

    if (tanggalSampai) {
      qb.andWhere('DATE(penunjangLab.waktuOrder) <= :tanggalSampai', {
        tanggalSampai,
      });
    }

    if (statusLab) {
      qb.andWhere('penunjangLab.statusLab = :statusLab', { statusLab });
    }

    if (pendaftaranId) {
      qb.andWhere('penunjangLab.pendaftaranId = :pendaftaranId', {
        pendaftaranId,
      });
    }

    if (typeof isCito === 'boolean') {
      qb.andWhere('penunjangLab.isCito = :isCito', { isCito });
    }

    const allowedSort = ['id', 'noLab', 'waktuOrder', 'statusLab', 'totalTarif'];
    const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'waktuOrder';
    const orderDirection = sortType === 'ASC' ? 'ASC' : 'DESC';

    const [rows, totalItems] = await qb
      .orderBy(`penunjangLab.${orderColumn}`, orderDirection)
      .addOrderBy('penunjangLab.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const orderIds = rows.map((row) => row.id);
    const [statsMap, itemsMap] = await Promise.all([
      this.fetchOrderStatsMap(orderIds, tenantId),
      this.fetchItemNamesMap(orderIds, tenantId),
    ]);

    const items = rows.map((row) => {
      const stats = statsMap.get(row.id);
      return {
        ...row,
        totalTarif: parseNumericMoney(row.totalTarif),
        totalJasaDokter: parseNumericMoney(row.totalJasaDokter),
        totalJasaNakes: parseNumericMoney(row.totalJasaNakes),
        dokterPengirimNama: row.dokterPengirim
          ? formatNamaGelarDokter(
              row.dokterPengirim.gelarDepan,
              row.dokterPengirim.penduduk?.namaLengkap,
              row.dokterPengirim.gelarBelakang,
            )
          : null,
        dokterLabNama: row.dokterLab
          ? formatNamaGelarDokter(
              row.dokterLab.gelarDepan,
              row.dokterLab.penduduk?.namaLengkap,
              row.dokterLab.gelarBelakang,
            )
          : null,
        itemNames: itemsMap.get(row.id) ?? [],
        jumlahItem: stats?.jumlahItem ?? 0,
        jumlahParameter: stats?.jumlahParameter ?? 0,
        jumlahTerisi: stats?.jumlahTerisi ?? 0,
        jumlahAbnormal: stats?.jumlahAbnormal ?? 0,
        jumlahKritis: stats?.jumlahKritis ?? 0,
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

  async findOne(id: number) {
    const tenantId = this.tenantId;
    const header = await this.repo
      .createQueryBuilder('penunjangLab')
      .leftJoinAndSelect('penunjangLab.pendaftaran', 'pendaftaran')
      .leftJoinAndSelect('pendaftaran.kelasSaatIni', 'kelasSaatIni')
      .leftJoinAndSelect('pendaftaran.penjamin', 'penjamin')
      .leftJoinAndSelect('penunjangLab.pasien', 'pasien')
      .leftJoinAndSelect('pasien.penduduk', 'penduduk')
      .leftJoinAndSelect('penunjangLab.unitPengirim', 'unitPengirim')
      .leftJoinAndSelect('penunjangLab.unitLab', 'unitLab')
      .leftJoinAndSelect('penunjangLab.dokterPengirim', 'dokterPengirim')
      .leftJoinAndSelect('dokterPengirim.penduduk', 'dokterPengirimPenduduk')
      .leftJoinAndSelect('penunjangLab.dokterLab', 'dokterLab')
      .leftJoinAndSelect('dokterLab.penduduk', 'dokterLabPenduduk')
      .leftJoinAndSelect('penunjangLab.petugasLab', 'petugasLab')
      .where('penunjangLab.id = :id', { id })
      .andWhere('penunjangLab.tenantId = :tenantId', { tenantId })
      .getOne();

    if (!header) {
      throw new NotFoundException(
        `Transaksi penunjang lab dengan ID #${id} tidak ditemukan.`,
      );
    }

    let [items, hasilList] = await Promise.all([
      this.itemRepo.find({
        where: { penunjangLabId: id, tenantId },
        relations: ['tindakan'],
        order: { urutan: 'ASC', id: 'ASC' },
      }),
      this.hasilRepo.find({
        where: { penunjangLabId: id, tenantId },
        order: { urutan: 'ASC', id: 'ASC' },
      }),
    ]);

    // Backfill otomatis jika ada item order (mis. order lama) yang belum punya baris hasil sama sekali
    if (
      header.statusLab !== StatusPenunjangLab.BATAL &&
      header.statusLab !== StatusPenunjangLab.TERVERIFIKASI
    ) {
      const itemIdsWithHasil = new Set(
        hasilList.map((row) => row.penunjangLabItemId),
      );
      const missingItems = items.filter((it) => !itemIdsWithHasil.has(it.id));
      if (missingItems.length > 0 && typeof this.hasilRepo.save === 'function') {
        const directRowsToInsert: PenunjangLabHasil[] = [];
        let nextOrder =
          hasilList.reduce((max, r) => Math.max(max, r.urutan || 0), 0) + 1;

        for (const it of missingItems) {
          const direct = this.buildDirectParameterEntry({
            kode: it.kodeTindakanSnapshot,
            nama: it.namaTindakanSnapshot,
            kelompokTarif: it.tindakan?.kelompokTarif ?? null,
            satuan: it.satuanSnapshot,
          });
          directRowsToInsert.push(
            this.hasilRepo.create({
              tenantId,
              penunjangLabId: header.id,
              penunjangLabItemId: it.id,
              parameterId: null,
              kodeParameterSnapshot: direct.kode,
              namaParameterSnapshot: direct.nama,
              grupSnapshot: direct.grup,
              satuanSnapshot: direct.satuan,
              tipeHasilSnapshot: direct.tipeHasil,
              opsiPilihanSnapshot: null,
              desimalSnapshot: direct.desimal,
              nilaiRujukanMinSnapshot: null,
              nilaiRujukanMaxSnapshot: null,
              kritisMinSnapshot: null,
              kritisMaxSnapshot: null,
              nilaiNormalTextSnapshot: null,
              isWajib: direct.isWajib,
              urutan: nextOrder++,
              hasilNilai: null,
              hasilAngka: null,
              flagAbnormal: null,
              isKritis: false,
              catatan: null,
              diinputOlehId: null,
              diinputPada: null,
            }),
          );
        }

        const inserted = await this.hasilRepo.save(directRowsToInsert);
        hasilList = [...hasilList, ...inserted].sort(
          (a, b) => (a.urutan ?? 0) - (b.urutan ?? 0) || a.id - b.id,
        );
      }
    }

    return {
      ...header,
      totalTarif: parseNumericMoney(header.totalTarif),
      totalJasaDokter: parseNumericMoney(header.totalJasaDokter),
      totalJasaNakes: parseNumericMoney(header.totalJasaNakes),
      dokterPengirimNama: header.dokterPengirim
        ? formatNamaGelarDokter(
            header.dokterPengirim.gelarDepan,
            header.dokterPengirim.penduduk?.namaLengkap,
            header.dokterPengirim.gelarBelakang,
          )
        : null,
      dokterLabNama: header.dokterLab
        ? formatNamaGelarDokter(
            header.dokterLab.gelarDepan,
            header.dokterLab.penduduk?.namaLengkap,
            header.dokterLab.gelarBelakang,
          )
        : null,
      items: items.map(({ tindakan, ...item }) => ({
        ...item,
        kelompokTarifSnapshot: tindakan?.kelompokTarif ?? null,
        jasaSarana: parseNumericMoney(item.jasaSarana),
        bhp: parseNumericMoney(item.bhp),
        jasaDokter: parseNumericMoney(item.jasaDokter),
        jasaNakes: parseNumericMoney(item.jasaNakes),
        tarifSatuan: parseNumericMoney(item.tarifSatuan),
        subtotalTarif: parseNumericMoney(item.subtotalTarif),
      })),
      hasilList: hasilList.map((row) => ({
        ...row,
        nilaiRujukanMinSnapshot:
          row.nilaiRujukanMinSnapshot !== null
            ? Number(row.nilaiRujukanMinSnapshot)
            : null,
        nilaiRujukanMaxSnapshot:
          row.nilaiRujukanMaxSnapshot !== null
            ? Number(row.nilaiRujukanMaxSnapshot)
            : null,
        kritisMinSnapshot:
          row.kritisMinSnapshot !== null ? Number(row.kritisMinSnapshot) : null,
        kritisMaxSnapshot:
          row.kritisMaxSnapshot !== null ? Number(row.kritisMaxSnapshot) : null,
        hasilAngka: row.hasilAngka !== null ? Number(row.hasilAngka) : null,
      })),
    };
  }

  async create(dto: CreatePenunjangLabDto) {
    const tenantId = this.tenantId;
    const rawActorId = this.tenantService.getUserId();
    const actorId = rawActorId ? Number(rawActorId) : null;

    if (dto.unitLabId) {
      await assertActiveMasterRecord(
        this.unitRepo,
        dto.unitLabId,
        tenantId,
        'Unit Laboratorium',
      );
    }
    if (dto.dokterLabId) {
      await assertActiveMasterRecord(
        this.dokterRepo,
        dto.dokterLabId,
        tenantId,
        'Dokter Laboratorium',
        false,
      );
    }
    if (dto.petugasLabId) {
      await this.assertActivePegawai(dto.petugasLabId, tenantId);
    }

    const inputByKey = new Map<
      string,
      { hasilNilai?: string | null; catatan?: string | null }
    >();
    for (const inputItem of dto.hasilInputs ?? []) {
      const key = inputItem.parameterId
        ? `${inputItem.tindakanId}:p:${inputItem.parameterId}`
        : `${inputItem.tindakanId}:direct`;
      inputByKey.set(key, {
        hasilNilai: inputItem.hasilNilai,
        catatan: inputItem.catatan,
      });
    }

    const createdId = await this.dataSource.transaction(async (manager) => {
      const pendaftaranLock = await manager.findOne(Pendaftaran, {
        where: { id: dto.pendaftaranId, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!pendaftaranLock) {
        throw new NotFoundException(
          `Data kunjungan pendaftaran #${dto.pendaftaranId} tidak ditemukan.`,
        );
      }

      const pendaftaranFull = await this.loadPendaftaranContext(
        dto.pendaftaranId,
        tenantId,
      );
      assertPendaftaranEligibleForLab(pendaftaranFull);

      const previewItems = await this.buildPreviewItems({
        tenantId,
        pendaftaran: pendaftaranFull,
        tindakanIds: dto.tindakanIds,
        unitLabId: dto.unitLabId ?? null,
      });

      const noLab = await generateNoLabAtomic(manager, tenantId);
      const now = new Date();

      let totalTarif = 0;
      let totalJasaDokter = 0;
      let totalJasaNakes = 0;

      for (const entry of previewItems) {
        const r = entry.resolvedTarif.rincian;
        if (r) {
          totalTarif += r.totalTarif;
          totalJasaDokter += r.jasaDokter;
          totalJasaNakes += r.jasaNakes;
        }
      }

      const headerRepo = manager.getRepository(PenunjangLab);
      const itemRepoTx = manager.getRepository(PenunjangLabItem);
      const hasilRepoTx = manager.getRepository(PenunjangLabHasil);

      const header = await headerRepo.save(
        headerRepo.create({
          tenantId,
          noLab,
          pendaftaranId: pendaftaranFull.id,
          pasienId: pendaftaranFull.pasienId,
          unitPengirimId: pendaftaranFull.unitSaatIniId,
          unitLabId: dto.unitLabId ?? null,
          dokterPengirimId: pendaftaranFull.dokterSaatIniId,
          dokterLabId: dto.dokterLabId ?? null,
          petugasLabId: dto.petugasLabId ?? null,
          penjaminIdSnapshot: pendaftaranFull.penjaminId,
          kelasIdSnapshot: pendaftaranFull.kelasSaatIniId,
          waktuOrder: now,
          statusLab: StatusPenunjangLab.DIPROSES,
          statusPembayaran: pendaftaranFull.statusPembayaran || 'BELUM_BAYAR',
          isCito: Boolean(dto.isCito),
          diagnosaKlinis: dto.diagnosaKlinis ?? null,
          catatanKlinis: dto.catatanKlinis ?? null,
          kesanLab: dto.kesanLab ?? null,
          totalTarif: totalTarif.toFixed(2),
          totalJasaDokter: totalJasaDokter.toFixed(2),
          totalJasaNakes: totalJasaNakes.toFixed(2),
          createdById: actorId,
          updatedById: actorId,
        }),
      );

      const hasilEntities: PenunjangLabHasil[] = [];
      let globalOrder = 1;
      let anyValueFilled = false;

      for (let i = 0; i < previewItems.length; i++) {
        const entry = previewItems[i];
        const rincian = entry.resolvedTarif.rincian;
        const savedItem = await itemRepoTx.save(
          itemRepoTx.create({
            tenantId,
            penunjangLabId: header.id,
            tindakanId: entry.tindakan.id,
            tarifLayananId: entry.resolvedTarif.rule?.id ?? null,
            kodeTindakanSnapshot: entry.tindakan.kode,
            namaTindakanSnapshot: entry.tindakan.nama,
            satuanSnapshot: entry.tindakan.satuan || 'Pemeriksaan',
            jasaSarana: (rincian?.jasaSarana ?? 0).toFixed(2),
            bhp: (rincian?.bhp ?? 0).toFixed(2),
            jasaDokter: (rincian?.jasaDokter ?? 0).toFixed(2),
            jasaNakes: (rincian?.jasaNakes ?? 0).toFixed(2),
            tarifSatuan: (rincian?.totalTarif ?? 0).toFixed(2),
            qty: 1,
            subtotalTarif: (rincian?.totalTarif ?? 0).toFixed(2),
            specificityScoreSnapshot: entry.resolvedTarif.skorKecocokan,
            keteranganTarifSnapshot: entry.resolvedTarif.keteranganKecocokan,
            urutan: i + 1,
          }),
        );

        for (const p of entry.parameters) {
          const inputKey = p.parameterId
            ? `${entry.tindakan.id}:p:${p.parameterId}`
            : `${entry.tindakan.id}:direct`;
          const initialInput = inputByKey.get(inputKey);
          const evaluated = evaluateHasilLab(
            initialInput?.hasilNilai ?? null,
            p.tipeHasil,
            p.desimal,
            {
              nilaiMin: p.rujukan?.nilaiMin,
              nilaiMax: p.rujukan?.nilaiMax,
              kritisMin: p.rujukan?.kritisMin,
              kritisMax: p.rujukan?.kritisMax,
              nilaiNormalText: p.rujukan?.nilaiNormalText,
            },
            p.nama,
          );

          if (evaluated.hasilNilai !== null) {
            anyValueFilled = true;
          }

          if (dto.tandaiSelesaiInput && p.isWajib && evaluated.hasilNilai === null) {
            throw new BadRequestException(
              `Parameter wajib "${p.nama}" pada "${entry.tindakan.nama}" harus diisi sebelum menyelesaikan input hasil.`,
            );
          }

          hasilEntities.push(
            hasilRepoTx.create({
              tenantId,
              penunjangLabId: header.id,
              penunjangLabItemId: savedItem.id,
              parameterId: p.parameterId,
              kodeParameterSnapshot: p.kode,
              namaParameterSnapshot: p.nama,
              grupSnapshot: p.grup,
              satuanSnapshot: p.satuan,
              tipeHasilSnapshot: p.tipeHasil,
              opsiPilihanSnapshot: p.opsiPilihan,
              desimalSnapshot: p.desimal,
              nilaiRujukanMinSnapshot:
                p.rujukan?.nilaiMin !== null && p.rujukan?.nilaiMin !== undefined
                  ? Number(p.rujukan.nilaiMin).toFixed(4)
                  : null,
              nilaiRujukanMaxSnapshot:
                p.rujukan?.nilaiMax !== null && p.rujukan?.nilaiMax !== undefined
                  ? Number(p.rujukan.nilaiMax).toFixed(4)
                  : null,
              kritisMinSnapshot:
                p.rujukan?.kritisMin !== null &&
                p.rujukan?.kritisMin !== undefined
                  ? Number(p.rujukan.kritisMin).toFixed(4)
                  : null,
              kritisMaxSnapshot:
                p.rujukan?.kritisMax !== null &&
                p.rujukan?.kritisMax !== undefined
                  ? Number(p.rujukan.kritisMax).toFixed(4)
                  : null,
              nilaiNormalTextSnapshot: p.rujukan?.displayText ?? null,
              isWajib: p.isWajib,
              urutan: globalOrder++,
              hasilNilai: evaluated.hasilNilai,
              hasilAngka: evaluated.hasilAngka,
              flagAbnormal: evaluated.flagAbnormal,
              isKritis: evaluated.isKritis,
              catatan: initialInput?.catatan ?? null,
              diinputOlehId: evaluated.hasilNilai !== null ? actorId : null,
              diinputPada: evaluated.hasilNilai !== null ? now : null,
            }),
          );
        }
      }

      if (hasilEntities.length > 0) {
        await hasilRepoTx.save(hasilEntities);
      }

      if (dto.tandaiSelesaiInput) {
        header.statusLab = StatusPenunjangLab.SELESAI_INPUT;
        header.waktuHasilSelesai = now;
        header.waktuSampelDiambil = header.waktuSampelDiambil ?? now;
        await headerRepo.save(header);
      } else if (anyValueFilled) {
        header.waktuSampelDiambil = now;
        await headerRepo.save(header);
      }

      return header.id;
    });

    return this.findOne(createdId);
  }

  async saveHasil(id: number, dto: SaveHasilPenunjangLabDto) {
    const tenantId = this.tenantId;
    const rawActorId = this.tenantService.getUserId();
    const actorId = rawActorId ? Number(rawActorId) : null;

    if (dto.dokterLabId) {
      await assertActiveMasterRecord(
        this.dokterRepo,
        dto.dokterLabId,
        tenantId,
        'Dokter Laboratorium',
        false,
      );
    }
    if (dto.petugasLabId) {
      await this.assertActivePegawai(dto.petugasLabId, tenantId);
    }

    await this.dataSource.transaction(async (manager) => {
      const headerRepo = manager.getRepository(PenunjangLab);
      const hasilRepoTx = manager.getRepository(PenunjangLabHasil);

      const header = await headerRepo.findOne({
        where: { id, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!header) {
        throw new NotFoundException(
          `Transaksi penunjang lab dengan ID #${id} tidak ditemukan.`,
        );
      }
      if (header.statusLab === StatusPenunjangLab.BATAL) {
        throw new BadRequestException(
          'Transaksi lab berstatus BATAL dan tidak dapat diubah.',
        );
      }
      if (header.statusLab === StatusPenunjangLab.TERVERIFIKASI) {
        throw new BadRequestException(
          'Hasil lab sudah TERVERIFIKASI dan terkunci untuk menjaga integritas rekam medis.',
        );
      }

      const existingHasil = await hasilRepoTx.find({
        where: { penunjangLabId: id, tenantId },
      });
      const hasilById = new Map<number, PenunjangLabHasil>(
        existingHasil.map((row) => [row.id, row]),
      );

      const now = new Date();
      for (const item of dto.hasilList) {
        const target = hasilById.get(item.id);
        if (!target) {
          throw new BadRequestException(
            `Baris hasil parameter #${item.id} tidak termasuk dalam transaksi lab ini.`,
          );
        }

        const evaluated = evaluateHasilLab(
          item.hasilNilai,
          target.tipeHasilSnapshot,
          target.desimalSnapshot,
          {
            nilaiMin: target.nilaiRujukanMinSnapshot,
            nilaiMax: target.nilaiRujukanMaxSnapshot,
            kritisMin: target.kritisMinSnapshot,
            kritisMax: target.kritisMaxSnapshot,
            nilaiNormalText: target.nilaiNormalTextSnapshot,
          },
          target.namaParameterSnapshot,
        );

        target.hasilNilai = evaluated.hasilNilai;
        target.hasilAngka = evaluated.hasilAngka;
        target.flagAbnormal = evaluated.flagAbnormal;
        target.isKritis = evaluated.isKritis;
        if (item.catatan !== undefined) {
          target.catatan = item.catatan;
        }
        target.diinputOlehId = evaluated.hasilNilai !== null ? actorId : null;
        target.diinputPada = evaluated.hasilNilai !== null ? now : null;
      }

      if (dto.tandaiSelesaiInput) {
        for (const row of existingHasil) {
          if (row.isWajib && (row.hasilNilai === null || row.hasilNilai === '')) {
            throw new BadRequestException(
              `Parameter wajib "${row.namaParameterSnapshot}" harus diisi sebelum menyelesaikan input hasil.`,
            );
          }
        }
        header.statusLab = StatusPenunjangLab.SELESAI_INPUT;
        header.waktuHasilSelesai = now;
      } else if (header.statusLab === StatusPenunjangLab.SELESAI_INPUT) {
        header.statusLab = StatusPenunjangLab.DIPROSES;
        header.waktuHasilSelesai = null;
      }

      if (dto.dokterLabId !== undefined) {
        header.dokterLabId = dto.dokterLabId;
      }
      if (dto.petugasLabId !== undefined) {
        header.petugasLabId = dto.petugasLabId;
      }
      if (dto.kesanLab !== undefined) {
        header.kesanLab = dto.kesanLab;
      }
      if (dto.waktuSampelDiambil !== undefined) {
        header.waktuSampelDiambil = dto.waktuSampelDiambil
          ? new Date(dto.waktuSampelDiambil)
          : null;
      } else if (!header.waktuSampelDiambil) {
        header.waktuSampelDiambil = now;
      }

      header.updatedById = actorId;

      if (existingHasil.length > 0) {
        await hasilRepoTx.save(existingHasil);
      }
      await headerRepo.save(header);
    });

    return this.findOne(id);
  }

  async verify(id: number, dto: VerifyPenunjangLabDto) {
    const tenantId = this.tenantId;
    const rawActorId = this.tenantService.getUserId();
    const actorId = rawActorId ? Number(rawActorId) : null;

    if (dto.dokterLabId) {
      await assertActiveMasterRecord(
        this.dokterRepo,
        dto.dokterLabId,
        tenantId,
        'Dokter Laboratorium',
        false,
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const headerRepo = manager.getRepository(PenunjangLab);
      const hasilRepoTx = manager.getRepository(PenunjangLabHasil);

      const header = await headerRepo.findOne({
        where: { id, tenantId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!header) {
        throw new NotFoundException(
          `Transaksi penunjang lab dengan ID #${id} tidak ditemukan.`,
        );
      }
      if (header.statusLab === StatusPenunjangLab.BATAL) {
        throw new BadRequestException(
          'Transaksi lab berstatus BATAL tidak dapat diverifikasi.',
        );
      }
      if (header.statusLab === StatusPenunjangLab.TERVERIFIKASI) {
        throw new BadRequestException('Hasil lab sudah berstatus TERVERIFIKASI.');
      }

      const hasilList = await hasilRepoTx.find({
        where: { penunjangLabId: id, tenantId },
      });
      for (const row of hasilList) {
        if (row.isWajib && (row.hasilNilai === null || row.hasilNilai === '')) {
          throw new BadRequestException(
            `Parameter wajib "${row.namaParameterSnapshot}" belum diisi sehingga hasil belum dapat diverifikasi.`,
          );
        }
      }

      const now = new Date();
      if (dto.dokterLabId !== undefined) {
        header.dokterLabId = dto.dokterLabId;
      }
      if (dto.kesanLab !== undefined) {
        header.kesanLab = dto.kesanLab;
      }
      header.statusLab = StatusPenunjangLab.TERVERIFIKASI;
      header.waktuHasilSelesai = header.waktuHasilSelesai ?? now;
      header.waktuVerifikasi = now;
      header.verifiedById = actorId;
      header.updatedById = actorId;

      await headerRepo.save(header);
    });

    return this.findOne(id);
  }

  async batal(id: number, dto: BatalPenunjangLabDto) {
    const tenantId = this.tenantId;
    const rawActorId = this.tenantService.getUserId();
    const actorId = rawActorId ? Number(rawActorId) : null;

    const existing = await this.repo.findOne({ where: { id, tenantId } });
    if (!existing) {
      throw new NotFoundException(
        `Transaksi penunjang lab dengan ID #${id} tidak ditemukan.`,
      );
    }
    if (existing.statusLab === StatusPenunjangLab.TERVERIFIKASI) {
      throw new BadRequestException(
        'Transaksi lab yang sudah TERVERIFIKASI tidak dapat dibatalkan.',
      );
    }
    if (existing.statusLab === StatusPenunjangLab.BATAL) {
      throw new BadRequestException('Transaksi lab sudah dibatalkan.');
    }

    existing.statusLab = StatusPenunjangLab.BATAL;
    existing.alasanBatal = dto.alasan;
    existing.updatedById = actorId;
    await this.repo.save(existing);

    return this.findOne(id);
  }

  private async loadPendaftaranContext(
    pendaftaranId: number,
    tenantId: string,
  ) {
    const row = await this.pendaftaranRepo
      .createQueryBuilder('pendaftaran')
      .leftJoinAndSelect('pendaftaran.pasien', 'pasien')
      .leftJoinAndSelect('pasien.penduduk', 'penduduk')
      .leftJoinAndSelect('pendaftaran.unitSaatIni', 'unitSaatIni')
      .leftJoinAndSelect('pendaftaran.kelasSaatIni', 'kelasSaatIni')
      .leftJoinAndSelect('pendaftaran.penjamin', 'penjamin')
      .where('pendaftaran.id = :pendaftaranId', { pendaftaranId })
      .andWhere('pendaftaran.tenantId = :tenantId', { tenantId })
      .getOne();

    if (!row) {
      throw new NotFoundException(
        `Data kunjungan pendaftaran #${pendaftaranId} tidak ditemukan.`,
      );
    }
    return row;
  }

  private async assertActivePegawai(pegawaiId: number, tenantId: string) {
    const pegawai = await this.pegawaiRepo.findOne({
      where: { id: pegawaiId, tenantId },
    });
    if (!pegawai) {
      throw new BadRequestException(
        `Pegawai analis lab dengan ID #${pegawaiId} tidak ditemukan.`,
      );
    }
    if (pegawai.statusAktif !== StatusAktifPegawai.AKTIF) {
      throw new BadRequestException(
        `Pegawai "${pegawai.name}" berstatus ${pegawai.statusAktif}.`,
      );
    }
    return pegawai;
  }

  private async buildPreviewItems(params: {
    tenantId: string;
    pendaftaran: Pendaftaran;
    tindakanIds: number[];
    unitLabId: number | null;
  }): Promise<BuiltPreviewTindakan[]> {
    const uniqueIds = Array.from(new Set(params.tindakanIds));
    const actions = await this.tindakanRepo.find({
      where: { id: In(uniqueIds), tenantId: params.tenantId },
    });

    if (actions.length !== uniqueIds.length) {
      throw new BadRequestException(
        'Sebagian tindakan laboratorium tidak ditemukan pada tenant ini.',
      );
    }

    const actionById = new Map<number, TarifTindakan>();
    for (const action of actions) {
      if (action.status !== StatusAktifMaster.AKTIF) {
        throw new BadRequestException(
          `Tindakan "${action.nama}" sedang nonaktif.`,
        );
      }
      if (action.jenisTarif !== JenisTarif.LABORATORIUM) {
        throw new BadRequestException(
          `Tindakan "${action.nama}" bukan kategori LABORATORIUM.`,
        );
      }
      actionById.set(action.id, action);
    }

    const unitCtx = params.unitLabId ?? params.pendaftaran.unitSaatIniId;
    const penjaminCtx = params.pendaftaran.penjaminId ?? null;
    const kelasCtx = params.pendaftaran.kelasSaatIniId ?? null;
    const today = getTodayIsoDate();

    const hargaQb = this.hargaRepo
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
      .where('tl.tenantId = :tenantId', { tenantId: params.tenantId })
      .andWhere('tl.tindakanId IN (:...uniqueIds)', { uniqueIds })
      .andWhere('tl.status = :status', { status: 'Y' })
      .andWhere('tl.berlakuMulai <= :today', { today })
      .andWhere('(tl.berlakuSampai IS NULL OR tl.berlakuSampai >= :today)', {
        today,
      });

    if (unitCtx) {
      hargaQb.andWhere('(tl.unitId = :unitCtx OR tl.unitId IS NULL)', {
        unitCtx,
      });
    } else {
      hargaQb.andWhere('tl.unitId IS NULL');
    }

    if (penjaminCtx) {
      hargaQb.andWhere(
        '(tl.penjaminId = :penjaminCtx OR tl.penjaminId IS NULL)',
        { penjaminCtx },
      );
    } else {
      hargaQb.andWhere('tl.penjaminId IS NULL');
    }

    if (kelasCtx) {
      hargaQb.andWhere('(tl.kelasId = :kelasCtx OR tl.kelasId IS NULL)', {
        kelasCtx,
      });
    } else {
      hargaQb.andWhere('tl.kelasId IS NULL');
    }

    const [candidateHargaRows, mappings] = await Promise.all([
      hargaQb.getMany(),
      this.mappingRepo
        .createQueryBuilder('m')
        .innerJoinAndSelect('m.parameter', 'param')
        .where('m.tenantId = :tenantId', { tenantId: params.tenantId })
        .andWhere('m.tindakanId IN (:...uniqueIds)', { uniqueIds })
        .andWhere('param.status = :status', { status: 'Y' })
        .orderBy('m.urutan', 'ASC')
        .addOrderBy('m.id', 'ASC')
        .getMany(),
    ]);

    const paramIds = Array.from(new Set(mappings.map((m) => m.parameterId)));
    const rujukanRows =
      paramIds.length > 0
        ? await this.rujukanRepo.find({
            where: {
              parameterId: In(paramIds),
              tenantId: params.tenantId,
            },
          })
        : [];

    const hargaByTindakan = new Map<number, TarifLayanan[]>();
    for (const row of candidateHargaRows) {
      const bucket = hargaByTindakan.get(row.tindakanId);
      if (bucket) bucket.push(row);
      else hargaByTindakan.set(row.tindakanId, [row]);
    }

    const rujukanByParam = new Map<number, LabParameterRujukan[]>();
    for (const row of rujukanRows) {
      const bucket = rujukanByParam.get(row.parameterId);
      if (bucket) bucket.push(row);
      else rujukanByParam.set(row.parameterId, [row]);
    }

    const mappingsByTindakan = new Map<number, LabTindakanParameter[]>();
    for (const m of mappings) {
      const bucket = mappingsByTindakan.get(m.tindakanId);
      if (bucket) bucket.push(m);
      else mappingsByTindakan.set(m.tindakanId, [m]);
    }

    const jenisKelamin = params.pendaftaran.pasien?.penduduk?.jenisKelamin;
    const tanggalLahir = params.pendaftaran.pasien?.penduduk?.tanggalLahir;

    return uniqueIds.map((tId) => {
      const tindakan = actionById.get(tId)!;
      const resolvedTarif = resolveBestTarifRule(
        hargaByTindakan.get(tId) ?? [],
        {
          unitId: unitCtx,
          penjaminId: penjaminCtx,
          kelasId: kelasCtx,
        },
      );

      const mapped = mappingsByTindakan.get(tId) ?? [];
      const parameters =
        mapped.length > 0
          ? mapped.map((m) => {
              const p = m.parameter;
              const matchedRujukan = resolveRujukanPasien(
                rujukanByParam.get(p.id) ?? [],
                jenisKelamin,
                tanggalLahir,
                today,
              );
              const displayText = formatRujukanDisplay(
                matchedRujukan,
                p.satuan,
              );

              return {
                parameterId: p.id,
                kode: p.kode,
                nama: p.nama,
                grup: m.subGrupLabel || p.grup,
                satuan: p.satuan,
                tipeHasil: p.tipeHasil,
                opsiPilihan: p.opsiPilihan,
                desimal: p.desimal,
                isWajib: m.isWajib,
                urutan: m.urutan,
                isStandaloneDirect: false,
                rujukan: matchedRujukan
                  ? {
                      id: matchedRujukan.id ?? null,
                      jenisKelamin: matchedRujukan.jenisKelamin,
                      labelUsia: matchedRujukan.labelUsia ?? null,
                      nilaiMin:
                        matchedRujukan.nilaiMin !== null &&
                        matchedRujukan.nilaiMin !== undefined
                          ? Number(matchedRujukan.nilaiMin)
                          : null,
                      nilaiMax:
                        matchedRujukan.nilaiMax !== null &&
                        matchedRujukan.nilaiMax !== undefined
                          ? Number(matchedRujukan.nilaiMax)
                          : null,
                      kritisMin:
                        matchedRujukan.kritisMin !== null &&
                        matchedRujukan.kritisMin !== undefined
                          ? Number(matchedRujukan.kritisMin)
                          : null,
                      kritisMax:
                        matchedRujukan.kritisMax !== null &&
                        matchedRujukan.kritisMax !== undefined
                          ? Number(matchedRujukan.kritisMax)
                          : null,
                      nilaiNormalText: matchedRujukan.nilaiNormalText ?? null,
                      displayText,
                    }
                  : null,
              };
            })
          : [
              // Tindakan tunggal tanpa sub-parameter tetap menyediakan 1 inputan hasil langsung
              this.buildDirectParameterEntry(tindakan),
            ];

      return {
        tindakan,
        resolvedTarif,
        parameters,
      };
    });
  }

  private buildDirectParameterEntry(tindakan: {
    kode: string;
    nama: string;
    kelompokTarif?: string | null;
    satuan?: string | null;
  }) {
    const rawSatuan = tindakan.satuan?.trim();
    const satuan =
      rawSatuan &&
      !['pemeriksaan', 'tindakan', 'paket'].includes(rawSatuan.toLowerCase())
        ? rawSatuan
        : null;

    return {
      parameterId: null as number | null,
      kode: tindakan.kode,
      nama: tindakan.nama,
      grup: tindakan.kelompokTarif ?? null,
      satuan,
      tipeHasil: TipeHasilLab.TEXT,
      opsiPilihan: null as string[] | null,
      desimal: 2,
      isWajib: true,
      urutan: 1,
      isStandaloneDirect: true,
      rujukan: null,
    };
  }

  private async fetchLabCountByPendaftaranIds(pendaftaranIds: number[]) {
    const map = new Map<number, number>();
    if (pendaftaranIds.length === 0) return map;

    const rows = await this.repo
      .createQueryBuilder('pl')
      .select('pl.pendaftaranId', 'pendaftaranId')
      .addSelect('COUNT(pl.id)', 'jumlahOrderLab')
      .where('pl.tenantId = :tenantId', { tenantId: this.tenantId })
      .andWhere('pl.pendaftaranId IN (:...pendaftaranIds)', { pendaftaranIds })
      .andWhere('pl.statusLab != :batal', { batal: StatusPenunjangLab.BATAL })
      .groupBy('pl.pendaftaranId')
      .getRawMany<PendaftaranLabCountRaw>();

    for (const row of rows) {
      map.set(Number(row.pendaftaranId), Number(row.jumlahOrderLab || 0));
    }
    return map;
  }

  private async fetchOrderStatsMap(orderIds: number[], tenantId: string) {
    const map = new Map<
      number,
      {
        jumlahItem: number;
        jumlahParameter: number;
        jumlahTerisi: number;
        jumlahAbnormal: number;
        jumlahKritis: number;
      }
    >();
    if (orderIds.length === 0) return map;

    const [itemCounts, hasilStats] = await Promise.all([
      this.itemRepo
        .createQueryBuilder('it')
        .select('it.penunjangLabId', 'penunjangLabId')
        .addSelect('COUNT(it.id)', 'jumlahItem')
        .where('it.tenantId = :tenantId', { tenantId })
        .andWhere('it.penunjangLabId IN (:...orderIds)', { orderIds })
        .groupBy('it.penunjangLabId')
        .getRawMany<{ penunjangLabId: string | number; jumlahItem: string }>(),
      this.hasilRepo
        .createQueryBuilder('h')
        .select('h.penunjangLabId', 'penunjangLabId')
        .addSelect('COUNT(h.id)', 'jumlahParameter')
        .addSelect(
          `SUM(CASE WHEN h.hasil_nilai IS NOT NULL AND h.hasil_nilai != '' THEN 1 ELSE 0 END)`,
          'jumlahTerisi',
        )
        .addSelect(
          `SUM(CASE WHEN h.flag_abnormal IS NOT NULL AND h.flag_abnormal != 'NORMAL' THEN 1 ELSE 0 END)`,
          'jumlahAbnormal',
        )
        .addSelect(
          `SUM(CASE WHEN h.is_kritis = true THEN 1 ELSE 0 END)`,
          'jumlahKritis',
        )
        .where('h.tenantId = :tenantId', { tenantId })
        .andWhere('h.penunjangLabId IN (:...orderIds)', { orderIds })
        .groupBy('h.penunjangLabId')
        .getRawMany<LabHeaderStatsRaw>(),
    ]);

    const itemMap = new Map<number, number>();
    for (const row of itemCounts) {
      itemMap.set(Number(row.penunjangLabId), Number(row.jumlahItem || 0));
    }

    for (const id of orderIds) {
      map.set(id, {
        jumlahItem: itemMap.get(id) ?? 0,
        jumlahParameter: 0,
        jumlahTerisi: 0,
        jumlahAbnormal: 0,
        jumlahKritis: 0,
      });
    }

    for (const row of hasilStats) {
      const id = Number(row.penunjangLabId);
      const current = map.get(id) ?? {
        jumlahItem: itemMap.get(id) ?? 0,
        jumlahParameter: 0,
        jumlahTerisi: 0,
        jumlahAbnormal: 0,
        jumlahKritis: 0,
      };
      current.jumlahParameter = Number(row.jumlahParameter || 0);
      current.jumlahTerisi = Number(row.jumlahTerisi || 0);
      current.jumlahAbnormal = Number(row.jumlahAbnormal || 0);
      current.jumlahKritis = Number(row.jumlahKritis || 0);
      map.set(id, current);
    }

    return map;
  }

  private async fetchItemNamesMap(orderIds: number[], tenantId: string) {
    const map = new Map<number, string[]>();
    if (orderIds.length === 0) return map;

    const rows = await this.itemRepo.find({
      where: { penunjangLabId: In(orderIds), tenantId },
      select: ['penunjangLabId', 'namaTindakanSnapshot', 'urutan'],
      order: { urutan: 'ASC', id: 'ASC' },
    });

    for (const row of rows) {
      const bucket = map.get(row.penunjangLabId);
      if (bucket) bucket.push(row.namaTindakanSnapshot);
      else map.set(row.penunjangLabId, [row.namaTindakanSnapshot]);
    }
    return map;
  }
}
