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
  Repository,
} from 'typeorm';
import { Pendaftaran } from '@entities/pendaftaran.entity';
import { PendaftaranUnitHistory } from '@entities/pendaftaran-unit-history.entity';
import { PendaftaranPenjamin } from '@entities/pendaftaran-penjamin.entity';
import { Pasien } from '@entities/pasien.entity';
import { PasienPenjamin } from '@entities/pasien-penjamin.entity';
import { Penjamin } from '@entities/penjamin.entity';
import { Unit } from '@entities/unit.entity';
import { Dokter } from '@entities/dokter.entity';
import { JadwalDokter } from '@entities/jadwal-dokter.entity';
import { Bed } from '@entities/bed.entity';
import { Kelas } from '@entities/kelas.entity';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { BaseTenantService } from '@common/tenant/base-tenant.service';
import { getPostgresErrorCode } from '@common/utils/postgres-error.util';
import {
  JenisPenjamin,
  JenisUnit,
  StatusAktifMaster,
  StatusKetersediaanBed,
} from '@src/master-simrs/constants/simrs.enum';
import { formatNamaGelarDokter } from '@src/master-simrs/helpers/master-entity.helper';
import {
  enrichJadwalDokterItem,
  resolveHariDariTanggal,
} from '@src/master-simrs/jadwal-dokter/helpers/jadwal-dokter.helper';
import { PasienService } from '@src/master-simrs/pasien/services/pasien.service';
import {
  ACTIVE_KUNJUNGAN_STATUSES,
  CaraKeluarPasien,
  CaraMasukPasien,
  INPATIENT_LAYANAN_SET,
  JenisLayananPendaftaran,
  JenisPerpindahanUnit,
  StatusKunjungan,
  StatusPenempatanUnit,
  UNIT_JENIS_TO_LAYANAN_MAP,
} from '../constants/pendaftaran.enum';
import {
  CreatePendaftaranDto,
  CreatePendaftaranPenjaminItemDto,
} from '../dto/create-pendaftaran.dto';
import { MutasiPendaftaranDto } from '../dto/mutasi-pendaftaran.dto';
import { UpdatePenjaminPendaftaranDto } from '../dto/update-penjamin-pendaftaran.dto';
import {
  BatalPendaftaranDto,
  BatalRanapDto,
  SelesaiPendaftaranDto,
} from '../dto/update-status-pendaftaran.dto';
import {
  QueryJadwalTersediaDto,
  QueryPendaftaranDto,
} from '../dto/query-pendaftaran.dto';

interface ResolvedPenjaminKunjungan {
  urutan: number;
  isUtama: boolean;
  jenisPenjamin: string;
  penjaminId: number | null;
  pasienPenjaminId: number | null;
  namaPenjaminSnapshot: string;
  noKartuSnapshot: string | null;
  kelasHakIdSnapshot: number | null;
  noSep: string | null;
  noRujukan: string | null;
  keterangan: string | null;
}

interface ResolvedPenjaminListResult {
  primary: ResolvedPenjaminKunjungan;
  items: ResolvedPenjaminKunjungan[];
}

interface PenjaminProfileSaveState {
  hasPrimaryProfileCard: boolean;
}

interface ResolvedTargetPlacement {
  unit: Unit;
  jenisLayanan: JenisLayananPendaftaran;
  dokter: Dokter;
  jadwalDokter: JadwalDokter | null;
  bed: Bed | null;
  kelasId: number | null;
  noAntrean: number | null;
  kodeAntrean: string | null;
}

interface JadwalUsageRawRow {
  jadwalDokterId: string | number;
  terpakaiTotal: string | number;
  terpakaiJkn: string | number;
  terpakaiNonJkn: string | number;
}

interface JadwalUsageStat {
  terpakaiTotal: number;
  terpakaiJkn: number;
  terpakaiNonJkn: number;
}

@Injectable()
export class PendaftaranService extends BaseTenantService<Pendaftaran> {
  constructor(
    @InjectRepository(Pendaftaran)
    private readonly repo: Repository<Pendaftaran>,
    @InjectRepository(PendaftaranUnitHistory)
    private readonly historyRepo: Repository<PendaftaranUnitHistory>,
    @InjectRepository(PendaftaranPenjamin)
    private readonly pendaftaranPenjaminRepo: Repository<PendaftaranPenjamin>,
    @InjectRepository(JadwalDokter)
    private readonly jadwalRepo: Repository<JadwalDokter>,
    private readonly dataSource: DataSource,
    private readonly pasienService: PasienService,
    tenantService: TenantContextService,
  ) {
    super(repo, tenantService, 'pendaftaran');
  }

  /**
   * Daftar transaksi pendaftaran terpaginasi dengan kondisi unit/dokter/bed saat ini (tanpa N+1 query).
   */
  async findAll(queryDto: QueryPendaftaranDto) {
    const page = Math.max(1, queryDto.page ?? 1);
    const limit = Math.max(1, Math.min(100, queryDto.limit ?? 10));
    const {
      search,
      tanggalDari,
      tanggalSampai,
      jenisLayanan,
      unitId,
      dokterId,
      penjaminId,
      jenisPenjamin,
      statusKunjungan,
      aktifSaja,
      sortBy = 'id',
      sortType = 'DESC',
    } = queryDto;

    const qb = this.createQuery()
      .leftJoin('pendaftaran.pasien', 'pasien')
      .leftJoin('pasien.penduduk', 'penduduk')
      .leftJoin('pendaftaran.unitSaatIni', 'unitSaatIni')
      .leftJoin('pendaftaran.dokterSaatIni', 'dokterSaatIni')
      .leftJoin('dokterSaatIni.penduduk', 'dokterPenduduk')
      .leftJoin('pendaftaran.jadwalDokterSaatIni', 'jadwalSaatIni')
      .leftJoin('pendaftaran.kelasSaatIni', 'kelasSaatIni')
      .leftJoin('pendaftaran.bedSaatIni', 'bedSaatIni')
      .leftJoin('pendaftaran.penjamin', 'penjamin')
      .leftJoin('pendaftaran.kelasHakSnapshot', 'kelasHakSnapshot')
      .select([
        'pendaftaran.id',
        'pendaftaran.noRegistrasi',
        'pendaftaran.pasienId',
        'pendaftaran.tanggalKunjungan',
        'pendaftaran.waktuDaftar',
        'pendaftaran.jenisLayananAwal',
        'pendaftaran.jenisLayananSaatIni',
        'pendaftaran.unitSaatIniId',
        'pendaftaran.dokterSaatIniId',
        'pendaftaran.jadwalDokterSaatIniId',
        'pendaftaran.kelasSaatIniId',
        'pendaftaran.bedSaatIniId',
        'pendaftaran.noAntreanSaatIni',
        'pendaftaran.kodeAntreanSaatIni',
        'pendaftaran.caraMasuk',
        'pendaftaran.jenisPenjamin',
        'pendaftaran.penjaminId',
        'pendaftaran.pasienPenjaminId',
        'pendaftaran.namaPenjaminSnapshot',
        'pendaftaran.noKartuSnapshot',
        'pendaftaran.kelasHakIdSnapshot',
        'pendaftaran.noSep',
        'pendaftaran.noRujukan',
        'pendaftaran.statusKunjungan',
        'pendaftaran.statusPembayaran',
        'pendaftaran.waktuKeluar',
        'pendaftaran.caraKeluar',
        'pendaftaran.createdAt',
        'pasien.id',
        'pasien.noRm',
        'pasien.isBayiBaruLahir',
        'pasien.isIdentitasTidakDiketahui',
        'penduduk.id',
        'penduduk.nik',
        'penduduk.namaLengkap',
        'penduduk.tanggalLahir',
        'penduduk.jenisKelamin',
        'penduduk.noTelepon',
        'unitSaatIni.id',
        'unitSaatIni.kode',
        'unitSaatIni.nama',
        'unitSaatIni.jenisUnit',
        'dokterSaatIni.id',
        'dokterSaatIni.kodeDokter',
        'dokterSaatIni.gelarDepan',
        'dokterSaatIni.gelarBelakang',
        'dokterSaatIni.spesialisasi',
        'dokterPenduduk.id',
        'dokterPenduduk.namaLengkap',
        'jadwalSaatIni.id',
        'jadwalSaatIni.hari',
        'jadwalSaatIni.jamMulai',
        'jadwalSaatIni.jamSelesai',
        'jadwalSaatIni.sesi',
        'jadwalSaatIni.ruangan',
        'kelasSaatIni.id',
        'kelasSaatIni.kode',
        'kelasSaatIni.nama',
        'bedSaatIni.id',
        'bedSaatIni.kode',
        'bedSaatIni.nama',
        'bedSaatIni.namaKamar',
        'bedSaatIni.statusKetersediaan',
        'penjamin.id',
        'penjamin.kode',
        'penjamin.nama',
        'penjamin.jenisPenjamin',
        'kelasHakSnapshot.id',
        'kelasHakSnapshot.kode',
        'kelasHakSnapshot.nama',
      ]);

    if (search && search.trim()) {
      const term = search.trim();
      const upperTerm = `%${term.toUpperCase()}%`;
      const exactLikeTerm = `%${term}%`;
      qb.andWhere(
        '(UPPER(pendaftaran.noRegistrasi) LIKE :upperTerm OR UPPER(pasien.noRm) LIKE :upperTerm OR UPPER(penduduk.namaLengkap) LIKE :upperTerm OR penduduk.nik LIKE :exactLikeTerm OR UPPER(pendaftaran.noKartuSnapshot) LIKE :upperTerm OR UPPER(pendaftaran.noSep) LIKE :upperTerm OR EXISTS (SELECT 1 FROM pendaftaran_penjamin ppj_s WHERE ppj_s.pendaftaran_id = pendaftaran.id AND ppj_s.tenant_id = pendaftaran.tenant_id AND (UPPER(ppj_s.no_kartu_snapshot) LIKE :upperTerm OR UPPER(ppj_s.no_sep) LIKE :upperTerm)))',
        { upperTerm, exactLikeTerm },
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

    if (jenisLayanan) {
      qb.andWhere('pendaftaran.jenisLayananSaatIni = :jenisLayanan', {
        jenisLayanan,
      });
    }

    if (unitId) {
      qb.andWhere('pendaftaran.unitSaatIniId = :unitId', { unitId });
    }

    if (dokterId) {
      qb.andWhere('pendaftaran.dokterSaatIniId = :dokterId', { dokterId });
    }

    if (penjaminId) {
      qb.andWhere(
        '(pendaftaran.penjaminId = :penjaminId OR EXISTS (SELECT 1 FROM pendaftaran_penjamin ppj_p WHERE ppj_p.pendaftaran_id = pendaftaran.id AND ppj_p.tenant_id = pendaftaran.tenant_id AND ppj_p.penjamin_id = :penjaminId))',
        { penjaminId },
      );
    }

    if (jenisPenjamin) {
      qb.andWhere(
        '(pendaftaran.jenisPenjamin = :jenisPenjamin OR EXISTS (SELECT 1 FROM pendaftaran_penjamin ppj_j WHERE ppj_j.pendaftaran_id = pendaftaran.id AND ppj_j.tenant_id = pendaftaran.tenant_id AND ppj_j.jenis_penjamin = :jenisPenjamin))',
        { jenisPenjamin },
      );
    }

    if (statusKunjungan) {
      qb.andWhere('pendaftaran.statusKunjungan = :statusKunjungan', {
        statusKunjungan,
      });
    } else if (aktifSaja) {
      qb.andWhere('pendaftaran.statusKunjungan IN (:...activeStatuses)', {
        activeStatuses: [...ACTIVE_KUNJUNGAN_STATUSES],
      });
    }

    const allowedSort = [
      'id',
      'noRegistrasi',
      'tanggalKunjungan',
      'waktuDaftar',
      'createdAt',
    ];
    const orderColumn = allowedSort.includes(sortBy) ? sortBy : 'id';
    const orderDirection = sortType === 'ASC' ? 'ASC' : 'DESC';

    const [rows, totalItems] = await qb
      .orderBy(`pendaftaran.${orderColumn}`, orderDirection)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const penjaminMap = await this.loadPenjaminMapForPendaftarans(
      rows.map((row) => row.id),
    );

    const items = rows.map((row) => ({
      ...row,
      dokterSaatIni: this.enrichDokterDisplay(row.dokterSaatIni),
      penjaminList: penjaminMap.get(row.id) ?? [],
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
   * Pilihan jadwal dokter praktik aktif untuk form pendaftaran/mutasi beserta sisa kuota JKN & Non-JKN (tanpa N+1).
   */
  async findJadwalDokterTersedia(queryDto: QueryJadwalTersediaDto) {
    const tenantId = this.tenantId;
    const tanggal = queryDto.tanggal ?? this.getTodayDateString();
    const hari = resolveHariDariTanggal(tanggal);

    const qb = this.jadwalRepo
      .createQueryBuilder('jadwalDokter')
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
        'jadwalDokter.status',
        'dokter.id',
        'dokter.kodeDokter',
        'dokter.gelarDepan',
        'dokter.gelarBelakang',
        'dokter.jenisDokter',
        'dokter.spesialisasi',
        'dokter.kodeBpjs',
        'dokter.status',
        'penduduk.id',
        'penduduk.namaLengkap',
        'unit.id',
        'unit.kode',
        'unit.nama',
        'unit.jenisUnit',
        'unit.status',
      ])
      .where('jadwalDokter.tenantId = :tenantId', { tenantId })
      .andWhere('jadwalDokter.hari = :hari', { hari })
      .andWhere('jadwalDokter.status = :aktif', {
        aktif: StatusAktifMaster.AKTIF,
      })
      .andWhere('dokter.status = :aktif', { aktif: StatusAktifMaster.AKTIF })
      .andWhere('unit.status = :aktif', { aktif: StatusAktifMaster.AKTIF });

    if (queryDto.unitId) {
      qb.andWhere('jadwalDokter.unitId = :unitId', { unitId: queryDto.unitId });
    }

    if (queryDto.dokterId) {
      qb.andWhere('jadwalDokter.dokterId = :dokterId', {
        dokterId: queryDto.dokterId,
      });
    }

    if (queryDto.sesi) {
      qb.andWhere('jadwalDokter.sesi = :sesi', { sesi: queryDto.sesi });
    }

    if (queryDto.search && queryDto.search.trim()) {
      const term = `%${queryDto.search.trim().toUpperCase()}%`;
      qb.andWhere(
        '(UPPER(dokter.kodeDokter) LIKE :term OR UPPER(penduduk.namaLengkap) LIKE :term OR UPPER(dokter.spesialisasi) LIKE :term OR UPPER(unit.kode) LIKE :term OR UPPER(unit.nama) LIKE :term)',
        { term },
      );
    }

    const schedules = await qb
      .orderBy('unit.nama', 'ASC')
      .addOrderBy('jadwalDokter.jamMulai', 'ASC')
      .getMany();

    if (schedules.length === 0) {
      return [];
    }

    const usageMap = await this.getJadwalUsageMap(
      this.dataSource.manager,
      tenantId,
      tanggal,
      schedules.map((s) => s.id),
    );

    return schedules.map((row) => {
      const enriched = enrichJadwalDokterItem(row);
      const usage = usageMap.get(row.id) ?? {
        terpakaiTotal: 0,
        terpakaiJkn: 0,
        terpakaiNonJkn: 0,
      };

      const quotaStatus = this.evaluateScheduleQuota(
        row,
        usage,
        queryDto.jenisPenjamin,
      );

      return {
        ...enriched,
        tanggal,
        kuotaInfo: quotaStatus,
      };
    });
  }

  /**
   * Detail lengkap kunjungan beserta timeline perpindahan antar unit.
   */
  async findOne(id: number) {
    const pendaftaran = await this.createQuery()
      .leftJoinAndSelect('pendaftaran.pasien', 'pasien')
      .leftJoinAndSelect('pasien.penduduk', 'penduduk')
      .leftJoinAndSelect('pendaftaran.unitSaatIni', 'unitSaatIni')
      .leftJoinAndSelect('pendaftaran.dokterSaatIni', 'dokterSaatIni')
      .leftJoinAndSelect('dokterSaatIni.penduduk', 'dokterPenduduk')
      .leftJoinAndSelect('pendaftaran.jadwalDokterSaatIni', 'jadwalSaatIni')
      .leftJoinAndSelect('pendaftaran.kelasSaatIni', 'kelasSaatIni')
      .leftJoinAndSelect('pendaftaran.bedSaatIni', 'bedSaatIni')
      .leftJoinAndSelect('pendaftaran.penjamin', 'penjamin')
      .leftJoinAndSelect('pendaftaran.pasienPenjamin', 'pasienPenjamin')
      .leftJoinAndSelect('pendaftaran.kelasHakSnapshot', 'kelasHakSnapshot')
      .andWhere('pendaftaran.id = :id', { id })
      .getOne();

    if (!pendaftaran) {
      throw new NotFoundException(
        `Data pendaftaran dengan ID #${id} tidak ditemukan.`,
      );
    }

    const [historyUnit, penjaminList] = await Promise.all([
      this.loadHistoryForPendaftaran(id),
      this.loadPenjaminForPendaftaran(id),
    ]);

    return {
      ...pendaftaran,
      dokterSaatIni: this.enrichDokterDisplay(pendaftaran.dokterSaatIni),
      historyUnit,
      penjaminList,
    };
  }

  /**
   * Riwayat kronologis perpindahan antar unit untuk 1 kunjungan pendaftaran.
   */
  async findHistoryUnit(pendaftaranId: number) {
    await this.findOneById(pendaftaranId);
    return this.loadHistoryForPendaftaran(pendaftaranId);
  }

  /**
   * Mendaftarkan kunjungan baru (pasien lama atau pasien baru terpadu, umum atau asuransi) dalam 1 transaksi atomik.
   */
  async create(dto: CreatePendaftaranDto) {
    const tenantId = this.tenantId;
    const tanggalKunjungan = dto.tanggalKunjungan ?? this.getTodayDateString();
    const waktuDaftar = new Date();
    const userId = this.getCurrentUserId();

    const savedId = await this.dataSource.transaction(async (manager) => {
      const pasien = await this.resolvePasienInTransaction(
        manager,
        tenantId,
        dto,
      );

      const rawPenjaminItems = this.normalizePenjaminInputItems(dto);
      const resolvedPenjaminResult =
        await this.resolvePenjaminListInTransaction(
          manager,
          tenantId,
          pasien.id,
          tanggalKunjungan,
          rawPenjaminItems,
        );
      const primaryPenjamin = resolvedPenjaminResult.primary;

      const placement = await this.resolveTargetPlacementInTransaction(
        manager,
        tenantId,
        {
          pasienId: pasien.id,
          unitId: dto.unitId,
          dokterId: dto.dokterId,
          jadwalDokterId: dto.jadwalDokterId,
          bedId: dto.bedId,
          tanggalEfektif: tanggalKunjungan,
          jenisPenjamin: primaryPenjamin.jenisPenjamin,
        },
      );

      if (INPATIENT_LAYANAN_SET.has(placement.jenisLayanan)) {
        await this.assertNoActiveInpatientForPatient(
          manager,
          tenantId,
          pasien.id,
        );
      }

      const noRegistrasi = await this.generateNoRegistrasiInTransaction(
        manager,
        tenantId,
        tanggalKunjungan,
      );

      const initialStatus = INPATIENT_LAYANAN_SET.has(placement.jenisLayanan)
        ? StatusKunjungan.DIRAWAT
        : StatusKunjungan.TERDAFTAR;

      const caraMasuk =
        dto.caraMasuk ??
        (placement.jenisLayanan === JenisLayananPendaftaran.IGD
          ? CaraMasukPasien.IGD
          : CaraMasukPasien.DATANG_SENDIRI);

      const pendaftaran = manager.create(Pendaftaran, {
        tenantId,
        noRegistrasi,
        pasienId: pasien.id,
        tanggalKunjungan,
        waktuDaftar,
        jenisLayananAwal: placement.jenisLayanan,
        jenisLayananSaatIni: placement.jenisLayanan,
        unitSaatIniId: placement.unit.id,
        dokterSaatIniId: placement.dokter.id,
        jadwalDokterSaatIniId: placement.jadwalDokter?.id ?? null,
        kelasSaatIniId: placement.kelasId,
        bedSaatIniId: placement.bed?.id ?? null,
        noAntreanSaatIni: placement.noAntrean,
        kodeAntreanSaatIni: placement.kodeAntrean,
        caraMasuk,
        asalRujukan: dto.asalRujukan ?? null,
        keluhanUtama: dto.keluhanUtama ?? null,
        jenisPenjamin: primaryPenjamin.jenisPenjamin,
        penjaminId: primaryPenjamin.penjaminId,
        pasienPenjaminId: primaryPenjamin.pasienPenjaminId,
        namaPenjaminSnapshot: primaryPenjamin.namaPenjaminSnapshot,
        noKartuSnapshot: primaryPenjamin.noKartuSnapshot,
        kelasHakIdSnapshot: primaryPenjamin.kelasHakIdSnapshot,
        noSep: primaryPenjamin.noSep,
        noRujukan: primaryPenjamin.noRujukan,
        statusKunjungan: initialStatus,
        catatan: dto.catatan ?? null,
        ihsEncounterId: dto.ihsEncounterId ?? null,
        createdById: userId,
        updatedById: userId,
      });

      const savedPendaftaran = await this.savePendaftaranWithConstraintHandling(
        manager,
        pendaftaran,
      );

      await this.persistPenjaminListInTransaction(
        manager,
        tenantId,
        savedPendaftaran.id,
        resolvedPenjaminResult.items,
        userId,
      );

      const historyEntry = manager.create(PendaftaranUnitHistory, {
        tenantId,
        pendaftaranId: savedPendaftaran.id,
        urutan: 1,
        tanggalKunjungan,
        jenisPerpindahan: JenisPerpindahanUnit.PENDAFTARAN_AWAL,
        unitAsalId: null,
        kelasAsalId: null,
        bedAsalId: null,
        dokterAsalId: null,
        unitTujuanId: placement.unit.id,
        jenisLayananTujuan: placement.jenisLayanan,
        kelasTujuanId: placement.kelasId,
        bedTujuanId: placement.bed?.id ?? null,
        dokterTujuanId: placement.dokter.id,
        jadwalDokterId: placement.jadwalDokter?.id ?? null,
        noAntrean: placement.noAntrean,
        kodeAntrean: placement.kodeAntrean,
        waktuMasuk: waktuDaftar,
        waktuKeluar: null,
        statusPenempatan: StatusPenempatanUnit.AKTIF,
        alasan: 'Pendaftaran kunjungan awal',
        catatan: dto.catatan ?? null,
        diprosesOlehId: userId,
      });

      await manager.save(PendaftaranUnitHistory, historyEntry);

      return savedPendaftaran.id;
    });

    return this.findOne(savedId);
  }

  /**
   * Memproses mutasi pasien antar unit (Rajal->Rajal, Rajal/IGD->Ranap, Ranap->Ranap/ICU/Pindah Bed).
   * Pasien Ranap tidak diperbolehkan dimutasi ke Rajal/IGD (harus melalui proses batalRanap).
   */
  async mutasi(id: number, dto: MutasiPendaftaranDto) {
    const tenantId = this.tenantId;
    const tanggalMutasi = dto.tanggalMutasi ?? this.getTodayDateString();
    const now = new Date();
    const userId = this.getCurrentUserId();

    await this.dataSource.transaction(async (manager) => {
      const pendaftaran = await this.lockActivePendaftaran(
        manager,
        tenantId,
        id,
      );

      const activeHistory = await manager.findOne(PendaftaranUnitHistory, {
        where: {
          tenantId,
          pendaftaranId: pendaftaran.id,
          statusPenempatan: StatusPenempatanUnit.AKTIF,
        },
        order: { urutan: 'DESC' },
      });

      if (!activeHistory) {
        throw new ConflictException(
          `Penempatan unit aktif untuk kunjungan "${pendaftaran.noRegistrasi}" tidak ditemukan.`,
        );
      }

      const target = await this.resolveTargetPlacementInTransaction(
        manager,
        tenantId,
        {
          pasienId: pendaftaran.pasienId,
          unitId: dto.unitTujuanId,
          dokterId: dto.dokterTujuanId,
          jadwalDokterId: dto.jadwalDokterId,
          bedId: dto.bedTujuanId,
          tanggalEfektif: tanggalMutasi,
          jenisPenjamin: pendaftaran.jenisPenjamin,
          allowedOccupiedBedId: pendaftaran.bedSaatIniId,
          excludePendaftaranId: pendaftaran.id,
        },
      );

      const currentlyInpatient = INPATIENT_LAYANAN_SET.has(
        pendaftaran.jenisLayananSaatIni,
      );
      const targetInpatient = INPATIENT_LAYANAN_SET.has(target.jenisLayanan);

      // Aturan Bisnis #3: Pasien yang sudah Rawat Inap / Intensive dilarang dimutasi kembali ke Rawat Jalan/IGD
      if (currentlyInpatient && !targetInpatient) {
        throw new BadRequestException(
          'Pasien yang sedang dirawat inap tidak dapat dimutasikan ke Rawat Jalan atau IGD. Gunakan fitur Batal Ranap jika rawat inap dibatalkan.',
        );
      }

      if (
        target.unit.id === pendaftaran.unitSaatIniId &&
        target.dokter.id === pendaftaran.dokterSaatIniId &&
        (target.bed?.id ?? null) === pendaftaran.bedSaatIniId &&
        (target.jadwalDokter?.id ?? null) === pendaftaran.jadwalDokterSaatIniId
      ) {
        throw new BadRequestException(
          'Unit, dokter, jadwal, dan bed tujuan mutasi sama persis dengan penempatan saat ini.',
        );
      }

      if (!currentlyInpatient && targetInpatient) {
        await this.assertNoActiveInpatientForPatient(
          manager,
          tenantId,
          pendaftaran.pasienId,
          pendaftaran.id,
        );
      }

      // Lepas bed lama -> KOSONG (sesuai aturan #1) jika pindah ke bed berbeda atau pindah keluar dari unit ber-bed
      if (
        pendaftaran.bedSaatIniId &&
        pendaftaran.bedSaatIniId !== (target.bed?.id ?? null)
      ) {
        await this.releaseBedInTransaction(
          manager,
          tenantId,
          pendaftaran.bedSaatIniId,
        );
      }

      const jenisPerpindahan = this.determineJenisPerpindahan({
        currentlyInpatient,
        targetInpatient,
        currentUnitId: pendaftaran.unitSaatIniId,
        targetUnitId: target.unit.id,
        currentBedId: pendaftaran.bedSaatIniId,
        targetBedId: target.bed?.id ?? null,
      });

      activeHistory.statusPenempatan = StatusPenempatanUnit.SELESAI;
      activeHistory.waktuKeluar = now;
      await manager.save(PendaftaranUnitHistory, activeHistory);

      const nextHistory = manager.create(PendaftaranUnitHistory, {
        tenantId,
        pendaftaranId: pendaftaran.id,
        urutan: activeHistory.urutan + 1,
        tanggalKunjungan: tanggalMutasi,
        jenisPerpindahan,
        unitAsalId: pendaftaran.unitSaatIniId,
        kelasAsalId: pendaftaran.kelasSaatIniId,
        bedAsalId: pendaftaran.bedSaatIniId,
        dokterAsalId: pendaftaran.dokterSaatIniId,
        unitTujuanId: target.unit.id,
        jenisLayananTujuan: target.jenisLayanan,
        kelasTujuanId: target.kelasId,
        bedTujuanId: target.bed?.id ?? null,
        dokterTujuanId: target.dokter.id,
        jadwalDokterId: target.jadwalDokter?.id ?? null,
        noAntrean: target.noAntrean,
        kodeAntrean: target.kodeAntrean,
        waktuMasuk: now,
        waktuKeluar: null,
        statusPenempatan: StatusPenempatanUnit.AKTIF,
        alasan: dto.alasan ?? `Mutasi ke ${target.unit.nama}`,
        catatan: dto.catatan ?? null,
        diprosesOlehId: userId,
      });

      await manager.save(PendaftaranUnitHistory, nextHistory);

      Object.assign(pendaftaran, {
        jenisLayananSaatIni: target.jenisLayanan,
        unitSaatIniId: target.unit.id,
        dokterSaatIniId: target.dokter.id,
        jadwalDokterSaatIniId: target.jadwalDokter?.id ?? null,
        kelasSaatIniId: target.kelasId,
        bedSaatIniId: target.bed?.id ?? null,
        noAntreanSaatIni: target.noAntrean,
        kodeAntreanSaatIni: target.kodeAntrean,
        statusKunjungan: targetInpatient
          ? StatusKunjungan.DIRAWAT
          : StatusKunjungan.DALAM_PELAYANAN,
        updatedById: userId,
      });

      await this.savePendaftaranWithConstraintHandling(manager, pendaftaran);
    });

    return this.findOne(id);
  }

  /**
   * Membatalkan status Rawat Inap pasien: mengosongkan bed -> KOSONG, menutup penempatan ranap dengan status BATAL,
   * lalu mengembalikan ke unit asal Rajal/IGD jika sebelumnya admisi dari Rajal/IGD atau membatalkan kunjungan jika daftar langsung Ranap.
   */
  async batalRanap(id: number, dto: BatalRanapDto) {
    const tenantId = this.tenantId;
    const now = new Date();
    const userId = this.getCurrentUserId();

    await this.dataSource.transaction(async (manager) => {
      const pendaftaran = await this.lockActivePendaftaran(
        manager,
        tenantId,
        id,
      );

      if (!INPATIENT_LAYANAN_SET.has(pendaftaran.jenisLayananSaatIni)) {
        throw new BadRequestException(
          'Fitur Batal Ranap hanya berlaku untuk pasien yang saat ini berstatus Rawat Inap atau Intensive.',
        );
      }

      if (pendaftaran.bedSaatIniId) {
        await this.releaseBedInTransaction(
          manager,
          tenantId,
          pendaftaran.bedSaatIniId,
        );
      }

      const allHistory = await manager.find(PendaftaranUnitHistory, {
        where: { tenantId, pendaftaranId: pendaftaran.id },
        order: { urutan: 'DESC' },
      });

      const activeHistory = allHistory.find(
        (item) => item.statusPenempatan === String(StatusPenempatanUnit.AKTIF),
      );
      const maxUrutan = allHistory[0]?.urutan ?? 0;

      if (activeHistory) {
        activeHistory.statusPenempatan = StatusPenempatanUnit.BATAL;
        activeHistory.waktuKeluar = now;
        activeHistory.alasan = dto.alasan;
        if (dto.catatan) {
          activeHistory.catatan = dto.catatan;
        }
        await manager.save(PendaftaranUnitHistory, activeHistory);
      }

      // Cari unit non-ranap terakhir (mis. IGD / Poli Rawat Jalan) sebelum pasien dimutasi ke Ranap
      const priorOutpatient = allHistory.find(
        (item) =>
          !INPATIENT_LAYANAN_SET.has(item.jenisLayananTujuan) &&
          item.statusPenempatan !== String(StatusPenempatanUnit.BATAL),
      );

      if (priorOutpatient) {
        const restoredHistory = manager.create(PendaftaranUnitHistory, {
          tenantId,
          pendaftaranId: pendaftaran.id,
          urutan: maxUrutan + 1,
          tanggalKunjungan: priorOutpatient.tanggalKunjungan,
          jenisPerpindahan: JenisPerpindahanUnit.BATAL_RANAP,
          unitAsalId: pendaftaran.unitSaatIniId,
          kelasAsalId: pendaftaran.kelasSaatIniId,
          bedAsalId: pendaftaran.bedSaatIniId,
          dokterAsalId: pendaftaran.dokterSaatIniId,
          unitTujuanId: priorOutpatient.unitTujuanId,
          jenisLayananTujuan: priorOutpatient.jenisLayananTujuan,
          kelasTujuanId: null,
          bedTujuanId: null,
          dokterTujuanId: priorOutpatient.dokterTujuanId,
          jadwalDokterId: priorOutpatient.jadwalDokterId,
          noAntrean: priorOutpatient.noAntrean,
          kodeAntrean: priorOutpatient.kodeAntrean,
          waktuMasuk: now,
          waktuKeluar: null,
          statusPenempatan: StatusPenempatanUnit.AKTIF,
          alasan: dto.alasan,
          catatan:
            dto.catatan ?? 'Dikembalikan ke unit asal setelah batal ranap',
          diprosesOlehId: userId,
        });
        await manager.save(PendaftaranUnitHistory, restoredHistory);

        Object.assign(pendaftaran, {
          jenisLayananSaatIni: priorOutpatient.jenisLayananTujuan,
          unitSaatIniId: priorOutpatient.unitTujuanId,
          dokterSaatIniId: priorOutpatient.dokterTujuanId,
          jadwalDokterSaatIniId: priorOutpatient.jadwalDokterId,
          kelasSaatIniId: null,
          bedSaatIniId: null,
          noAntreanSaatIni: priorOutpatient.noAntrean,
          kodeAntreanSaatIni: priorOutpatient.kodeAntrean,
          statusKunjungan: StatusKunjungan.DALAM_PELAYANAN,
          updatedById: userId,
        });
      } else {
        Object.assign(pendaftaran, {
          kelasSaatIniId: null,
          bedSaatIniId: null,
          statusKunjungan: StatusKunjungan.BATAL,
          waktuKeluar: now,
          alasanBatal: dto.alasan,
          catatan: dto.catatan ?? pendaftaran.catatan,
          updatedById: userId,
        });
      }

      await manager.save(Pendaftaran, pendaftaran);
    });

    return this.findOne(id);
  }

  /**
   * Menyelesaikan / memulangkan pasien (discharge) dan mengosongkan bed -> KOSONG.
   */
  async selesai(id: number, dto: SelesaiPendaftaranDto) {
    const tenantId = this.tenantId;
    const exitTime = dto.waktuKeluar ? new Date(dto.waktuKeluar) : new Date();
    const userId = this.getCurrentUserId();

    await this.dataSource.transaction(async (manager) => {
      const pendaftaran = await this.lockActivePendaftaran(
        manager,
        tenantId,
        id,
      );

      if (exitTime < pendaftaran.waktuDaftar) {
        throw new BadRequestException(
          'Waktu keluar/discharge tidak boleh lebih awal dari waktu pendaftaran.',
        );
      }

      if (pendaftaran.bedSaatIniId) {
        await this.releaseBedInTransaction(
          manager,
          tenantId,
          pendaftaran.bedSaatIniId,
        );
      }

      const activeHistory = await manager.findOne(PendaftaranUnitHistory, {
        where: {
          tenantId,
          pendaftaranId: pendaftaran.id,
          statusPenempatan: StatusPenempatanUnit.AKTIF,
        },
      });

      if (activeHistory) {
        activeHistory.statusPenempatan = StatusPenempatanUnit.SELESAI;
        activeHistory.waktuKeluar = exitTime;
        await manager.save(PendaftaranUnitHistory, activeHistory);
      }

      Object.assign(pendaftaran, {
        statusKunjungan: StatusKunjungan.SELESAI,
        waktuKeluar: exitTime,
        caraKeluar: dto.caraKeluar ?? CaraKeluarPasien.PULANG_SEMBUH,
        catatan: dto.catatan ?? pendaftaran.catatan,
        updatedById: userId,
      });

      await manager.save(Pendaftaran, pendaftaran);
    });

    return this.findOne(id);
  }

  /**
   * Membatalkan kunjungan pendaftaran dan melepas bed (jika terisi) menjadi KOSONG.
   */
  async batal(id: number, dto: BatalPendaftaranDto) {
    const tenantId = this.tenantId;
    const now = new Date();
    const userId = this.getCurrentUserId();

    await this.dataSource.transaction(async (manager) => {
      const pendaftaran = await this.lockActivePendaftaran(
        manager,
        tenantId,
        id,
      );

      if (pendaftaran.bedSaatIniId) {
        await this.releaseBedInTransaction(
          manager,
          tenantId,
          pendaftaran.bedSaatIniId,
        );
      }

      const activeHistory = await manager.findOne(PendaftaranUnitHistory, {
        where: {
          tenantId,
          pendaftaranId: pendaftaran.id,
          statusPenempatan: StatusPenempatanUnit.AKTIF,
        },
      });

      if (activeHistory) {
        activeHistory.statusPenempatan = StatusPenempatanUnit.BATAL;
        activeHistory.waktuKeluar = now;
        activeHistory.alasan = dto.alasan;
        if (dto.catatan) {
          activeHistory.catatan = dto.catatan;
        }
        await manager.save(PendaftaranUnitHistory, activeHistory);
      }

      Object.assign(pendaftaran, {
        statusKunjungan: StatusKunjungan.BATAL,
        waktuKeluar: now,
        alasanBatal: dto.alasan,
        catatan: dto.catatan ?? pendaftaran.catatan,
        updatedById: userId,
      });

      await manager.save(Pendaftaran, pendaftaran);
    });

    return this.findOne(id);
  }

  /**
   * Memperbarui konfigurasi penjamin (mendukung multi-penjamin / COB) pada kunjungan yang masih aktif.
   */
  async updatePenjamin(id: number, dto: UpdatePenjaminPendaftaranDto) {
    const tenantId = this.tenantId;
    const userId = this.getCurrentUserId();

    await this.dataSource.transaction(async (manager) => {
      const pendaftaran = await this.lockActivePendaftaran(
        manager,
        tenantId,
        id,
      );

      const resolved = await this.resolvePenjaminListInTransaction(
        manager,
        tenantId,
        pendaftaran.pasienId,
        pendaftaran.tanggalKunjungan,
        dto.penjaminList,
      );
      const primary = resolved.primary;

      // Jika kunjungan memiliki jadwal dokter Rajal dengan kuota terpisah JKN vs Non-JKN
      // dan jenis penjamin utama berpindah kategori, pastikan kuota kategori tujuan masih tersedia.
      const oldIsJkn =
        pendaftaran.jenisPenjamin === String(JenisPenjamin.BPJS);
      const newIsJkn = primary.jenisPenjamin === String(JenisPenjamin.BPJS);
      if (oldIsJkn !== newIsJkn && pendaftaran.jadwalDokterSaatIniId) {
        const jadwal = await manager.findOne(JadwalDokter, {
          where: { id: pendaftaran.jadwalDokterSaatIniId, tenantId },
        });
        if (jadwal && jadwal.kuotaTotal > 0) {
          const usageMap = await this.getJadwalUsageMap(
            manager,
            tenantId,
            pendaftaran.tanggalKunjungan,
            [jadwal.id],
          );
          const usage = usageMap.get(jadwal.id) ?? {
            terpakaiTotal: 0,
            terpakaiJkn: 0,
            terpakaiNonJkn: 0,
          };
          if (newIsJkn && jadwal.kuotaJkn > 0 && usage.terpakaiJkn >= jadwal.kuotaJkn) {
            throw new ConflictException(
              `Kuota pasien JKN/BPJS pada jadwal dokter (${jadwal.kuotaJkn} pasien) sudah penuh.`,
            );
          }
          if (
            !newIsJkn &&
            jadwal.kuotaNonJkn > 0 &&
            usage.terpakaiNonJkn >= jadwal.kuotaNonJkn
          ) {
            throw new ConflictException(
              `Kuota pasien Non-JKN pada jadwal dokter (${jadwal.kuotaNonJkn} pasien) sudah penuh.`,
            );
          }
        }
      }

      await manager.delete(PendaftaranPenjamin, {
        tenantId,
        pendaftaranId: pendaftaran.id,
      });

      await this.persistPenjaminListInTransaction(
        manager,
        tenantId,
        pendaftaran.id,
        resolved.items,
        userId,
      );

      pendaftaran.jenisPenjamin = primary.jenisPenjamin;
      pendaftaran.penjaminId = primary.penjaminId;
      pendaftaran.pasienPenjaminId = primary.pasienPenjaminId;
      pendaftaran.namaPenjaminSnapshot = primary.namaPenjaminSnapshot;
      pendaftaran.noKartuSnapshot = primary.noKartuSnapshot;
      pendaftaran.kelasHakIdSnapshot = primary.kelasHakIdSnapshot;
      pendaftaran.noSep = primary.noSep;
      pendaftaran.noRujukan = primary.noRujukan;
      pendaftaran.updatedById = userId;

      await manager.save(Pendaftaran, pendaftaran);
    });

    return this.findOne(id);
  }

  private async loadPenjaminMapForPendaftarans(
    pendaftaranIds: number[],
  ): Promise<Map<number, PendaftaranPenjamin[]>> {
    const map = new Map<number, PendaftaranPenjamin[]>();
    if (pendaftaranIds.length === 0) return map;

    const rows = await this.pendaftaranPenjaminRepo.find({
      where: {
        tenantId: this.tenantId,
        pendaftaranId: In(pendaftaranIds),
      },
      relations: ['penjamin', 'kelasHakSnapshot'],
      order: { urutan: 'ASC', id: 'ASC' },
    });

    for (const row of rows) {
      const existing = map.get(row.pendaftaranId);
      if (existing) {
        existing.push(row);
      } else {
        map.set(row.pendaftaranId, [row]);
      }
    }

    return map;
  }

  private async loadPenjaminForPendaftaran(
    pendaftaranId: number,
  ): Promise<PendaftaranPenjamin[]> {
    return this.pendaftaranPenjaminRepo.find({
      where: {
        tenantId: this.tenantId,
        pendaftaranId,
      },
      relations: ['penjamin', 'pasienPenjamin', 'kelasHakSnapshot'],
      order: { urutan: 'ASC', id: 'ASC' },
    });
  }

  private async persistPenjaminListInTransaction(
    manager: EntityManager,
    tenantId: string,
    pendaftaranId: number,
    items: ResolvedPenjaminKunjungan[],
    userId: number | null,
  ): Promise<void> {
    const entities = items.map((item) =>
      manager.create(PendaftaranPenjamin, {
        tenantId,
        pendaftaranId,
        urutan: item.urutan,
        isUtama: item.isUtama,
        jenisPenjamin: item.jenisPenjamin,
        penjaminId: item.penjaminId,
        pasienPenjaminId: item.pasienPenjaminId,
        namaPenjaminSnapshot: item.namaPenjaminSnapshot,
        noKartuSnapshot: item.noKartuSnapshot,
        kelasHakIdSnapshot: item.kelasHakIdSnapshot,
        noSep: item.noSep,
        noRujukan: item.noRujukan,
        keterangan: item.keterangan,
        createdById: userId,
        updatedById: userId,
      }),
    );

    await manager.save(PendaftaranPenjamin, entities);
  }

  private async loadHistoryForPendaftaran(pendaftaranId: number) {
    const rows = await this.historyRepo
      .createQueryBuilder('history')
      .leftJoin('history.unitAsal', 'unitAsal')
      .leftJoin('history.kelasAsal', 'kelasAsal')
      .leftJoin('history.bedAsal', 'bedAsal')
      .leftJoin('history.dokterAsal', 'dokterAsal')
      .leftJoin('dokterAsal.penduduk', 'dokterAsalPenduduk')
      .leftJoin('history.unitTujuan', 'unitTujuan')
      .leftJoin('history.kelasTujuan', 'kelasTujuan')
      .leftJoin('history.bedTujuan', 'bedTujuan')
      .leftJoin('history.dokterTujuan', 'dokterTujuan')
      .leftJoin('dokterTujuan.penduduk', 'dokterTujuanPenduduk')
      .leftJoin('history.jadwalDokter', 'jadwalDokter')
      .select([
        'history.id',
        'history.pendaftaranId',
        'history.urutan',
        'history.tanggalKunjungan',
        'history.jenisPerpindahan',
        'history.unitAsalId',
        'history.kelasAsalId',
        'history.bedAsalId',
        'history.dokterAsalId',
        'history.unitTujuanId',
        'history.jenisLayananTujuan',
        'history.kelasTujuanId',
        'history.bedTujuanId',
        'history.dokterTujuanId',
        'history.jadwalDokterId',
        'history.noAntrean',
        'history.kodeAntrean',
        'history.waktuMasuk',
        'history.waktuKeluar',
        'history.statusPenempatan',
        'history.alasan',
        'history.catatan',
        'history.diprosesOlehId',
        'unitAsal.id',
        'unitAsal.kode',
        'unitAsal.nama',
        'unitAsal.jenisUnit',
        'kelasAsal.id',
        'kelasAsal.kode',
        'kelasAsal.nama',
        'bedAsal.id',
        'bedAsal.kode',
        'bedAsal.nama',
        'bedAsal.namaKamar',
        'dokterAsal.id',
        'dokterAsal.kodeDokter',
        'dokterAsal.gelarDepan',
        'dokterAsal.gelarBelakang',
        'dokterAsalPenduduk.id',
        'dokterAsalPenduduk.namaLengkap',
        'unitTujuan.id',
        'unitTujuan.kode',
        'unitTujuan.nama',
        'unitTujuan.jenisUnit',
        'kelasTujuan.id',
        'kelasTujuan.kode',
        'kelasTujuan.nama',
        'bedTujuan.id',
        'bedTujuan.kode',
        'bedTujuan.nama',
        'bedTujuan.namaKamar',
        'dokterTujuan.id',
        'dokterTujuan.kodeDokter',
        'dokterTujuan.gelarDepan',
        'dokterTujuan.gelarBelakang',
        'dokterTujuanPenduduk.id',
        'dokterTujuanPenduduk.namaLengkap',
        'jadwalDokter.id',
        'jadwalDokter.hari',
        'jadwalDokter.jamMulai',
        'jadwalDokter.jamSelesai',
        'jadwalDokter.sesi',
        'jadwalDokter.ruangan',
      ])
      .where('history.tenantId = :tenantId', { tenantId: this.tenantId })
      .andWhere('history.pendaftaranId = :pendaftaranId', { pendaftaranId })
      .orderBy('history.urutan', 'ASC')
      .getMany();

    return rows.map((item) => {
      const endMs = item.waktuKeluar
        ? new Date(item.waktuKeluar).getTime()
        : Date.now();
      const startMs = new Date(item.waktuMasuk).getTime();
      const durasiMenit = Math.max(0, Math.round((endMs - startMs) / 60000));

      return {
        ...item,
        durasiMenit,
        dokterAsal: this.enrichDokterDisplay(item.dokterAsal),
        dokterTujuan: this.enrichDokterDisplay(item.dokterTujuan),
      };
    });
  }

  private async lockActivePendaftaran(
    manager: EntityManager,
    tenantId: string,
    id: number,
  ): Promise<Pendaftaran> {
    const pendaftaran = await manager.findOne(Pendaftaran, {
      where: { id, tenantId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!pendaftaran) {
      throw new NotFoundException(
        `Data pendaftaran dengan ID #${id} tidak ditemukan.`,
      );
    }

    if (
      !ACTIVE_KUNJUNGAN_STATUSES.includes(
        pendaftaran.statusKunjungan as StatusKunjungan,
      )
    ) {
      throw new ConflictException(
        `Kunjungan "${pendaftaran.noRegistrasi}" sudah berstatus ${pendaftaran.statusKunjungan} dan tidak dapat diubah lagi.`,
      );
    }

    return pendaftaran;
  }

  private async resolvePasienInTransaction(
    manager: EntityManager,
    tenantId: string,
    dto: CreatePendaftaranDto,
  ): Promise<Pasien> {
    if (dto.pasienId && dto.pasienBaru) {
      throw new BadRequestException(
        'Pilih salah satu: gunakan pasienId eksisting atau kirim objek pasienBaru, bukan keduanya.',
      );
    }

    if (!dto.pasienId && !dto.pasienBaru) {
      throw new BadRequestException(
        'pasienId atau objek pasienBaru wajib diisi untuk mendaftarkan kunjungan.',
      );
    }

    if (dto.pasienId) {
      const pasien = await manager.findOne(Pasien, {
        where: { id: dto.pasienId, tenantId },
      });
      if (!pasien) {
        throw new NotFoundException(
          `Pasien dengan ID #${dto.pasienId} tidak ditemukan.`,
        );
      }
      if (pasien.status !== String(StatusAktifMaster.AKTIF)) {
        throw new BadRequestException(
          `Data pasien "${pasien.noRm}" sedang berstatus nonaktif.`,
        );
      }
      return pasien;
    }

    return this.pasienService.createInTransaction(
      manager,
      tenantId,
      dto.pasienBaru!,
    );
  }

  private normalizePenjaminInputItems(
    dto: CreatePendaftaranDto,
  ): CreatePendaftaranPenjaminItemDto[] {
    if (dto.penjaminList && dto.penjaminList.length > 0) {
      return dto.penjaminList;
    }

    return [
      {
        urutan: 1,
        isUtama: true,
        jenisPenjamin: dto.jenisPenjamin,
        penjaminId: dto.penjaminId,
        pasienPenjaminId: dto.pasienPenjaminId,
        noKartu: dto.noKartu,
        kelasHakId: dto.kelasHakId,
        faskesPerujuk: dto.faskesPerujuk,
        berlakuSampai: dto.berlakuSampai,
        simpanKeProfilPasien: dto.simpanKeProfilPasien,
        noSep: dto.noSep,
        noRujukan: dto.noRujukan,
      },
    ];
  }

  private async resolvePenjaminListInTransaction(
    manager: EntityManager,
    tenantId: string,
    pasienId: number,
    tanggalKunjungan: string,
    rawItems: CreatePendaftaranPenjaminItemDto[],
  ): Promise<ResolvedPenjaminListResult> {
    if (!rawItems || rawItems.length === 0) {
      throw new BadRequestException(
        'Minimal harus ada 1 cara bayar / penjamin dalam pendaftaran kunjungan.',
      );
    }

    const explicitPrimaryIndexes = rawItems
      .map((item, idx) => (item.isUtama === true ? idx : -1))
      .filter((idx) => idx >= 0);

    if (explicitPrimaryIndexes.length > 1) {
      throw new BadRequestException(
        'Hanya satu penjamin utama (isUtama = true) yang diperbolehkan per kunjungan.',
      );
    }

    const urutanOneIndex = rawItems.findIndex((item) => item.urutan === 1);
    const primaryInputIndex =
      explicitPrimaryIndexes.length === 1
        ? explicitPrimaryIndexes[0]
        : urutanOneIndex >= 0
          ? urutanOneIndex
          : 0;

    const existingPrimaryProfile = await manager.findOne(PasienPenjamin, {
      where: { tenantId, pasienId, isUtama: true },
      select: ['id'],
    });
    const profileSaveState: PenjaminProfileSaveState = {
      hasPrimaryProfileCard: Boolean(existingPrimaryProfile),
    };

    const processingOrder = [
      primaryInputIndex,
      ...rawItems
        .map((_, idx) => idx)
        .filter((idx) => idx !== primaryInputIndex),
    ];

    const seenPasienPenjaminIds = new Set<number>();
    const seenPenjaminKeys = new Set<string>();
    const resolvedEntries: Array<{
      originalIndex: number;
      resolved: ResolvedPenjaminKunjungan;
    }> = [];

    for (const originalIndex of processingOrder) {
      const itemDto = rawItems[originalIndex];
      const resolved = await this.resolveSinglePenjaminItemInTransaction(
        manager,
        tenantId,
        pasienId,
        tanggalKunjungan,
        itemDto,
        profileSaveState,
        seenPasienPenjaminIds,
        seenPenjaminKeys,
      );
      resolvedEntries.push({ originalIndex, resolved });
    }

    if (
      resolvedEntries.length > 1 &&
      resolvedEntries.some(
        (entry) =>
          entry.resolved.jenisPenjamin === String(JenisPenjamin.UMUM),
      )
    ) {
      throw new BadRequestException(
        'Cara bayar UMUM / Pribadi tidak dapat digabungkan dengan asuransi/penjamin lain dalam satu kunjungan.',
      );
    }

    const primaryEntry = resolvedEntries.find(
      (entry) => entry.originalIndex === primaryInputIndex,
    )!;
    const secondaryEntries = resolvedEntries
      .filter((entry) => entry.originalIndex !== primaryInputIndex)
      .sort((a, b) => {
        const urutanA =
          rawItems[a.originalIndex].urutan ?? Number.MAX_SAFE_INTEGER;
        const urutanB =
          rawItems[b.originalIndex].urutan ?? Number.MAX_SAFE_INTEGER;
        if (urutanA !== urutanB) return urutanA - urutanB;
        return a.originalIndex - b.originalIndex;
      });

    const primary: ResolvedPenjaminKunjungan = {
      ...primaryEntry.resolved,
      urutan: 1,
      isUtama: true,
    };

    const items: ResolvedPenjaminKunjungan[] = [
      primary,
      ...secondaryEntries.map((entry, idx) => ({
        ...entry.resolved,
        urutan: idx + 2,
        isUtama: false,
      })),
    ];

    return { primary, items };
  }

  private assertUniqueResolvedPenjamin(
    seenPasienPenjaminIds: Set<number>,
    seenPenjaminKeys: Set<string>,
    pasienPenjaminId: number | null,
    penjaminId: number | null,
    noKartu: string | null,
    namaPenjamin: string,
  ): void {
    if (pasienPenjaminId !== null) {
      if (seenPasienPenjaminIds.has(pasienPenjaminId)) {
        throw new BadRequestException(
          `Kartu penjamin "${namaPenjamin}" yang sama tidak boleh dipilih lebih dari sekali dalam satu kunjungan.`,
        );
      }
      seenPasienPenjaminIds.add(pasienPenjaminId);
    }

    if (penjaminId !== null) {
      const normalizedKey = `${penjaminId}:${(noKartu ?? '').trim().toUpperCase()}`;
      if (seenPenjaminKeys.has(normalizedKey)) {
        const suffix = noKartu ? ` (${noKartu})` : '';
        throw new BadRequestException(
          `Penjamin "${namaPenjamin}"${suffix} tidak boleh didaftarkan ganda dalam satu kunjungan.`,
        );
      }
      seenPenjaminKeys.add(normalizedKey);
    }
  }

  private async resolveSinglePenjaminItemInTransaction(
    manager: EntityManager,
    tenantId: string,
    pasienId: number,
    tanggalKunjungan: string,
    dto: CreatePendaftaranPenjaminItemDto,
    profileSaveState: PenjaminProfileSaveState,
    seenPasienPenjaminIds: Set<number>,
    seenPenjaminKeys: Set<string>,
  ): Promise<ResolvedPenjaminKunjungan> {
    if (!dto.jenisPenjamin && !dto.penjaminId && !dto.pasienPenjaminId) {
      throw new BadRequestException(
        'Cara bayar wajib ditentukan: isi jenisPenjamin, penjaminId, atau pasienPenjaminId.',
      );
    }

    if (dto.pasienPenjaminId) {
      return this.resolveFromExistingPasienPenjamin(
        manager,
        tenantId,
        pasienId,
        tanggalKunjungan,
        dto,
        seenPasienPenjaminIds,
        seenPenjaminKeys,
      );
    }

    if (dto.penjaminId) {
      return this.resolveFromMasterPenjamin(
        manager,
        tenantId,
        pasienId,
        tanggalKunjungan,
        dto,
        profileSaveState,
        seenPasienPenjaminIds,
        seenPenjaminKeys,
      );
    }

    // Mode jenisPenjamin tanpa penjaminId: hanya diizinkan untuk UMUM
    if (dto.jenisPenjamin !== JenisPenjamin.UMUM) {
      throw new BadRequestException(
        `Penjamin bertipe ${dto.jenisPenjamin} wajib menyertakan penjaminId atau pasienPenjaminId.`,
      );
    }

    const masterUmum = await manager.findOne(Penjamin, {
      where: [
        {
          tenantId,
          jenisPenjamin: JenisPenjamin.UMUM,
          status: StatusAktifMaster.AKTIF,
        },
        {
          tenantId: IsNull(),
          jenisPenjamin: JenisPenjamin.UMUM,
          status: StatusAktifMaster.AKTIF,
        },
      ],
      order: { id: 'ASC' },
    });

    this.assertUniqueResolvedPenjamin(
      seenPasienPenjaminIds,
      seenPenjaminKeys,
      null,
      masterUmum?.id ?? null,
      null,
      masterUmum?.nama ?? 'Umum / Pribadi',
    );

    return {
      urutan: dto.urutan ?? 1,
      isUtama: Boolean(dto.isUtama),
      jenisPenjamin: JenisPenjamin.UMUM,
      penjaminId: masterUmum?.id ?? null,
      pasienPenjaminId: null,
      namaPenjaminSnapshot: masterUmum?.nama ?? 'Umum / Pribadi',
      noKartuSnapshot: null,
      kelasHakIdSnapshot: null,
      noSep: dto.noSep ?? null,
      noRujukan: dto.noRujukan ?? null,
      keterangan: dto.keterangan ?? null,
    };
  }

  private async resolveFromExistingPasienPenjamin(
    manager: EntityManager,
    tenantId: string,
    pasienId: number,
    tanggalKunjungan: string,
    dto: CreatePendaftaranPenjaminItemDto,
    seenPasienPenjaminIds: Set<number>,
    seenPenjaminKeys: Set<string>,
  ): Promise<ResolvedPenjaminKunjungan> {
    const pp = await manager.findOne(PasienPenjamin, {
      where: { id: dto.pasienPenjaminId, pasienId, tenantId },
      relations: ['penjamin'],
    });
    if (!pp) {
      throw new BadRequestException(
        `Data penjamin pasien dengan ID #${dto.pasienPenjaminId} tidak ditemukan pada pasien ini.`,
      );
    }
    if (pp.status !== String(StatusAktifMaster.AKTIF)) {
      throw new BadRequestException(
        'Kartu penjamin pasien tersebut sedang berstatus nonaktif.',
      );
    }

    const master = pp.penjamin;
    if (!master || master.status !== String(StatusAktifMaster.AKTIF)) {
      throw new BadRequestException(
        'Master penjamin terkait sedang nonaktif atau tidak tersedia.',
      );
    }

    if (dto.penjaminId && dto.penjaminId !== master.id) {
      throw new BadRequestException(
        'penjaminId tidak sesuai dengan master penjamin pada pasienPenjaminId yang dipilih.',
      );
    }

    if (
      dto.jenisPenjamin &&
      dto.jenisPenjamin !== (master.jenisPenjamin as JenisPenjamin)
    ) {
      throw new BadRequestException(
        `jenisPenjamin "${dto.jenisPenjamin}" tidak sesuai dengan penjamin "${master.nama}" (${master.jenisPenjamin}).`,
      );
    }

    this.assertTanggalBerlaku(
      pp.berlakuSampai,
      tanggalKunjungan,
      `Kartu/polis "${master.nama}"`,
    );
    this.assertTanggalBerlaku(
      master.pksBerlakuSampai,
      tanggalKunjungan,
      `Masa PKS penjamin "${master.nama}"`,
    );

    const effectiveNoKartu = dto.noKartu ?? pp.noKartu ?? null;
    if (master.butuhNoKartu && !effectiveNoKartu) {
      throw new BadRequestException(
        `Penjamin "${master.nama}" wajib memiliki nomor kartu/polis.`,
      );
    }

    this.assertUniqueResolvedPenjamin(
      seenPasienPenjaminIds,
      seenPenjaminKeys,
      pp.id,
      master.id,
      effectiveNoKartu,
      master.nama,
    );

    return {
      urutan: dto.urutan ?? 1,
      isUtama: Boolean(dto.isUtama),
      jenisPenjamin: master.jenisPenjamin,
      penjaminId: master.id,
      pasienPenjaminId: pp.id,
      namaPenjaminSnapshot: master.nama,
      noKartuSnapshot: effectiveNoKartu,
      kelasHakIdSnapshot: dto.kelasHakId ?? pp.kelasHakId ?? null,
      noSep: dto.noSep ?? null,
      noRujukan: dto.noRujukan ?? null,
      keterangan: dto.keterangan ?? null,
    };
  }

  private async resolveFromMasterPenjamin(
    manager: EntityManager,
    tenantId: string,
    pasienId: number,
    tanggalKunjungan: string,
    dto: CreatePendaftaranPenjaminItemDto,
    profileSaveState: PenjaminProfileSaveState,
    seenPasienPenjaminIds: Set<number>,
    seenPenjaminKeys: Set<string>,
  ): Promise<ResolvedPenjaminKunjungan> {
    const master = await manager.findOne(Penjamin, {
      where: [
        { id: dto.penjaminId, tenantId },
        { id: dto.penjaminId, tenantId: IsNull() },
      ],
    });
    if (!master) {
      throw new BadRequestException(
        `Master Penjamin dengan ID #${dto.penjaminId} tidak ditemukan.`,
      );
    }
    if (master.status !== String(StatusAktifMaster.AKTIF)) {
      throw new BadRequestException(
        `Master Penjamin "${master.nama}" sedang nonaktif.`,
      );
    }

    if (
      dto.jenisPenjamin &&
      dto.jenisPenjamin !== (master.jenisPenjamin as JenisPenjamin)
    ) {
      throw new BadRequestException(
        `jenisPenjamin "${dto.jenisPenjamin}" tidak sesuai dengan master penjamin "${master.nama}" (${master.jenisPenjamin}).`,
      );
    }

    this.assertTanggalBerlaku(
      master.pksBerlakuSampai,
      tanggalKunjungan,
      `Masa PKS penjamin "${master.nama}"`,
    );
    this.assertTanggalBerlaku(
      dto.berlakuSampai ?? null,
      tanggalKunjungan,
      `Masa berlaku kartu "${master.nama}"`,
    );

    if (master.butuhNoKartu && !dto.noKartu?.trim()) {
      throw new BadRequestException(
        `Penjamin "${master.nama}" wajib menyertakan nomor kartu / polis.`,
      );
    }

    if (dto.kelasHakId) {
      const kelasHak = await manager.findOne(Kelas, {
        where: [
          { id: dto.kelasHakId, tenantId },
          { id: dto.kelasHakId, tenantId: IsNull() },
        ],
        select: ['id', 'status'],
      });
      if (!kelasHak || kelasHak.status !== String(StatusAktifMaster.AKTIF)) {
        throw new BadRequestException(
          `Kelas hak dengan ID #${dto.kelasHakId} tidak ditemukan atau nonaktif.`,
        );
      }
    }

    // Validasi unik terlebih dahulu sebelum berpotensi menulis ke profil pasien
    this.assertUniqueResolvedPenjamin(
      seenPasienPenjaminIds,
      seenPenjaminKeys,
      null,
      master.id,
      dto.noKartu ?? null,
      master.nama,
    );

    let linkedPasienPenjaminId: number | null = null;
    if (master.jenisPenjamin !== String(JenisPenjamin.UMUM)) {
      const existingCard = await manager.findOne(PasienPenjamin, {
        where: {
          tenantId,
          pasienId,
          penjaminId: master.id,
          noKartu: dto.noKartu ? dto.noKartu : IsNull(),
        },
        select: ['id', 'status'],
      });

      if (existingCard) {
        if (existingCard.status !== String(StatusAktifMaster.AKTIF)) {
          throw new BadRequestException(
            `Kartu penjamin "${master.nama}" pada profil pasien sedang nonaktif.`,
          );
        }
        if (seenPasienPenjaminIds.has(existingCard.id)) {
          throw new BadRequestException(
            `Kartu penjamin "${master.nama}" yang sama tidak boleh didaftarkan lebih dari sekali.`,
          );
        }
        seenPasienPenjaminIds.add(existingCard.id);
        linkedPasienPenjaminId = existingCard.id;
      } else if (dto.simpanKeProfilPasien !== false) {
        const isUtamaProfil = !profileSaveState.hasPrimaryProfileCard;
        const newPp = manager.create(PasienPenjamin, {
          tenantId,
          pasienId,
          penjaminId: master.id,
          noKartu: dto.noKartu ?? null,
          kelasHakId: dto.kelasHakId ?? null,
          faskesPerujuk: dto.faskesPerujuk ?? null,
          berlakuSampai: dto.berlakuSampai ?? null,
          isUtama: isUtamaProfil,
          status: StatusAktifMaster.AKTIF,
        });
        const savedPp = await manager.save(PasienPenjamin, newPp);
        if (isUtamaProfil) {
          profileSaveState.hasPrimaryProfileCard = true;
        }
        linkedPasienPenjaminId = savedPp.id;
      }
    }

    return {
      urutan: dto.urutan ?? 1,
      isUtama: Boolean(dto.isUtama),
      jenisPenjamin: master.jenisPenjamin,
      penjaminId: master.id,
      pasienPenjaminId: linkedPasienPenjaminId,
      namaPenjaminSnapshot: master.nama,
      noKartuSnapshot: dto.noKartu ?? null,
      kelasHakIdSnapshot: dto.kelasHakId ?? null,
      noSep: dto.noSep ?? null,
      noRujukan: dto.noRujukan ?? null,
      keterangan: dto.keterangan ?? null,
    };
  }

  private async resolveTargetPlacementInTransaction(
    manager: EntityManager,
    tenantId: string,
    params: {
      pasienId: number;
      unitId: number;
      dokterId?: number;
      jadwalDokterId?: number;
      bedId?: number;
      tanggalEfektif: string;
      jenisPenjamin: string;
      allowedOccupiedBedId?: number | null;
      excludePendaftaranId?: number;
    },
  ): Promise<ResolvedTargetPlacement> {
    const unit = await manager.findOne(Unit, {
      where: { id: params.unitId, tenantId },
    });
    if (!unit) {
      throw new BadRequestException(
        `Unit pelayanan dengan ID #${params.unitId} tidak ditemukan.`,
      );
    }
    if (unit.status !== String(StatusAktifMaster.AKTIF)) {
      throw new BadRequestException(`Unit "${unit.nama}" sedang nonaktif.`);
    }

    const jenisLayanan = UNIT_JENIS_TO_LAYANAN_MAP[unit.jenisUnit as JenisUnit];
    if (!jenisLayanan) {
      throw new BadRequestException(
        `Unit "${unit.nama}" bertipe ${unit.jenisUnit} dan bukan unit pendaftaran/perawatan pasien.`,
      );
    }

    let jadwalDokter: JadwalDokter | null = null;
    let dokter: Dokter | null = null;
    let noAntrean: number | null = null;
    let kodeAntrean: string | null = null;

    if (
      jenisLayanan === JenisLayananPendaftaran.RAWAT_JALAN &&
      !params.jadwalDokterId
    ) {
      throw new BadRequestException(
        `Pendaftaran/mutasi ke poliklinik rawat jalan "${unit.nama}" wajib memilih jadwalDokterId praktik dokter.`,
      );
    }

    if (params.jadwalDokterId) {
      const slot = await this.allocateJadwalSlotInTransaction(
        manager,
        tenantId,
        {
          pasienId: params.pasienId,
          unit,
          jadwalDokterId: params.jadwalDokterId,
          expectedDokterId: params.dokterId,
          tanggalEfektif: params.tanggalEfektif,
          jenisPenjamin: params.jenisPenjamin,
          excludePendaftaranId: params.excludePendaftaranId,
        },
      );
      jadwalDokter = slot.jadwal;
      dokter = slot.dokter;
      noAntrean = slot.noAntrean;
      kodeAntrean = slot.kodeAntrean;
    } else {
      if (!params.dokterId) {
        throw new BadRequestException(
          'dokterId wajib diisi apabila tidak menggunakan jadwalDokterId.',
        );
      }
      dokter = await manager.findOne(Dokter, {
        where: { id: params.dokterId, tenantId },
      });
      if (!dokter) {
        throw new BadRequestException(
          `Dokter dengan ID #${params.dokterId} tidak ditemukan.`,
        );
      }
      if (dokter.status !== String(StatusAktifMaster.AKTIF)) {
        throw new BadRequestException(
          `Dokter "${dokter.kodeDokter}" sedang berstatus nonaktif.`,
        );
      }
    }

    const isInpatient = INPATIENT_LAYANAN_SET.has(jenisLayanan);
    let bed: Bed | null = null;

    if (isInpatient) {
      if (!params.bedId) {
        throw new BadRequestException(
          `Pendaftaran/mutasi ke unit ${unit.nama} (${jenisLayanan}) wajib memilih bedId tujuan.`,
        );
      }
      bed = await this.allocateBedInTransaction(
        manager,
        tenantId,
        unit,
        params.bedId,
        params.allowedOccupiedBedId ?? null,
      );
    } else if (params.bedId) {
      if (jenisLayanan === JenisLayananPendaftaran.RAWAT_JALAN) {
        throw new BadRequestException(
          'Unit Rawat Jalan tidak menggunakan penempatan tempat tidur (bedId).',
        );
      }
      bed = await this.allocateBedInTransaction(
        manager,
        tenantId,
        unit,
        params.bedId,
        params.allowedOccupiedBedId ?? null,
      );
    }

    return {
      unit,
      jenisLayanan,
      dokter,
      jadwalDokter,
      bed,
      kelasId: bed?.kelasId ?? unit.kelasDefaultId ?? null,
      noAntrean,
      kodeAntrean,
    };
  }

  private async allocateJadwalSlotInTransaction(
    manager: EntityManager,
    tenantId: string,
    params: {
      pasienId: number;
      unit: Unit;
      jadwalDokterId: number;
      expectedDokterId?: number;
      tanggalEfektif: string;
      jenisPenjamin: string;
      excludePendaftaranId?: number;
    },
  ): Promise<{
    jadwal: JadwalDokter;
    dokter: Dokter;
    noAntrean: number;
    kodeAntrean: string;
  }> {
    const jadwal = await manager.findOne(JadwalDokter, {
      where: { id: params.jadwalDokterId, tenantId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!jadwal) {
      throw new BadRequestException(
        `Jadwal dokter dengan ID #${params.jadwalDokterId} tidak ditemukan.`,
      );
    }
    if (jadwal.status !== String(StatusAktifMaster.AKTIF)) {
      throw new BadRequestException(
        'Jadwal praktik dokter yang dipilih sedang nonaktif.',
      );
    }
    if (jadwal.unitId !== params.unit.id) {
      throw new BadRequestException(
        `Jadwal dokter #${jadwal.id} tidak terdaftar pada unit "${params.unit.nama}".`,
      );
    }
    if (
      params.expectedDokterId &&
      params.expectedDokterId !== jadwal.dokterId
    ) {
      throw new BadRequestException(
        'dokterId yang dikirim tidak sesuai dengan dokter pada jadwal praktik yang dipilih.',
      );
    }

    const hariTanggal = resolveHariDariTanggal(params.tanggalEfektif);
    if (jadwal.hari !== String(hariTanggal)) {
      throw new BadRequestException(
        `Jadwal dokter hanya praktik pada hari ${jadwal.hari}, sedangkan tanggal ${params.tanggalEfektif} jatuh pada hari ${hariTanggal}.`,
      );
    }

    const dokter = await manager.findOne(Dokter, {
      where: { id: jadwal.dokterId, tenantId },
    });
    if (!dokter || dokter.status !== String(StatusAktifMaster.AKTIF)) {
      throw new BadRequestException(
        'Dokter pada jadwal praktik tersebut tidak aktif.',
      );
    }

    // Cegah pasien mendaftar aktif 2x pada jadwal dokter & tanggal yang sama
    const dupQb = manager
      .createQueryBuilder(PendaftaranUnitHistory, 'puh')
      .innerJoin('puh.pendaftaran', 'p')
      .select('p.id', 'pendaftaranId')
      .where('puh.tenantId = :tenantId', { tenantId })
      .andWhere('p.pasienId = :pasienId', { pasienId: params.pasienId })
      .andWhere('puh.jadwalDokterId = :jadwalDokterId', {
        jadwalDokterId: jadwal.id,
      })
      .andWhere('puh.tanggalKunjungan = :tanggal', {
        tanggal: params.tanggalEfektif,
      })
      .andWhere('puh.statusPenempatan = :aktif', {
        aktif: StatusPenempatanUnit.AKTIF,
      })
      .andWhere('p.statusKunjungan IN (:...activeStatuses)', {
        activeStatuses: [...ACTIVE_KUNJUNGAN_STATUSES],
      });

    if (params.excludePendaftaranId) {
      dupQb.andWhere('p.id != :excludeId', {
        excludeId: params.excludePendaftaranId,
      });
    }

    const dupBooking = await dupQb.getRawOne<{ pendaftaranId: number }>();
    if (dupBooking) {
      throw new ConflictException(
        'Pasien sudah memiliki antrean aktif pada jadwal dokter dan tanggal yang sama.',
      );
    }

    const usageMap = await this.getJadwalUsageMap(
      manager,
      tenantId,
      params.tanggalEfektif,
      [jadwal.id],
    );
    const usage = usageMap.get(jadwal.id) ?? {
      terpakaiTotal: 0,
      terpakaiJkn: 0,
      terpakaiNonJkn: 0,
    };

    const quotaEvaluation = this.evaluateScheduleQuota(
      jadwal,
      usage,
      params.jenisPenjamin as JenisPenjamin,
    );

    if (quotaEvaluation.isPenuh) {
      throw new ConflictException(
        quotaEvaluation.alasanPenuh ??
          `Kuota jadwal praktik dokter pada ${params.unit.nama} (${params.tanggalEfektif}) sudah penuh.`,
      );
    }

    const counterKey = `ANT_J_${jadwal.id}_${params.tanggalEfektif.replace(/-/g, '')}`;
    const noAntrean = await this.incrementTenantCounter(
      manager,
      tenantId,
      counterKey,
    );
    const unitPrefix = params.unit.kode.toUpperCase().slice(0, 10);
    const kodeAntrean = `${unitPrefix}-${String(noAntrean).padStart(3, '0')}`;

    return { jadwal, dokter, noAntrean, kodeAntrean };
  }

  private async allocateBedInTransaction(
    manager: EntityManager,
    tenantId: string,
    unit: Unit,
    bedId: number,
    allowedOccupiedBedId: number | null,
  ): Promise<Bed> {
    if (!unit.isTersediaBed) {
      throw new BadRequestException(
        `Unit "${unit.nama}" tidak dikonfigurasi untuk memiliki tempat tidur (isTersediaBed = false).`,
      );
    }

    const bed = await manager.findOne(Bed, {
      where: { id: bedId, tenantId },
      lock: { mode: 'pessimistic_write' },
    });

    if (!bed) {
      throw new BadRequestException(`Bed dengan ID #${bedId} tidak ditemukan.`);
    }
    if (bed.status !== String(StatusAktifMaster.AKTIF)) {
      throw new BadRequestException(`Bed "${bed.kode}" sedang nonaktif.`);
    }
    if (bed.unitId !== unit.id) {
      throw new BadRequestException(
        `Bed "${bed.kode}" tidak berada pada unit "${unit.nama}".`,
      );
    }

    const isSameCurrentBed =
      allowedOccupiedBedId !== null && bed.id === allowedOccupiedBedId;

    if (
      !isSameCurrentBed &&
      bed.statusKetersediaan !== String(StatusKetersediaanBed.KOSONG)
    ) {
      throw new ConflictException(
        `Bed "${bed.kode}" (${bed.nama}) tidak tersedia karena sedang berstatus ${bed.statusKetersediaan}.`,
      );
    }

    if (!isSameCurrentBed) {
      bed.statusKetersediaan = StatusKetersediaanBed.TERISI;
      await manager.save(Bed, bed);
    }

    return bed;
  }

  private async releaseBedInTransaction(
    manager: EntityManager,
    tenantId: string,
    bedId: number,
  ): Promise<void> {
    const bed = await manager.findOne(Bed, {
      where: { id: bedId, tenantId },
      lock: { mode: 'pessimistic_write' },
    });

    if (
      bed &&
      bed.statusKetersediaan !== String(StatusKetersediaanBed.KOSONG)
    ) {
      bed.statusKetersediaan = StatusKetersediaanBed.KOSONG;
      await manager.save(Bed, bed);
    }
  }

  private async getJadwalUsageMap(
    manager: EntityManager,
    tenantId: string,
    tanggal: string,
    jadwalIds: number[],
  ): Promise<Map<number, JadwalUsageStat>> {
    const map = new Map<number, JadwalUsageStat>();
    if (jadwalIds.length === 0) return map;

    const rawRows = await manager
      .createQueryBuilder(PendaftaranUnitHistory, 'puh')
      .innerJoin('puh.pendaftaran', 'p')
      .select('puh.jadwalDokterId', 'jadwalDokterId')
      .addSelect('COUNT(DISTINCT puh.pendaftaranId)', 'terpakaiTotal')
      .addSelect(
        'COUNT(DISTINCT CASE WHEN p.jenisPenjamin = :bpjs THEN puh.pendaftaranId END)',
        'terpakaiJkn',
      )
      .addSelect(
        'COUNT(DISTINCT CASE WHEN p.jenisPenjamin != :bpjs THEN puh.pendaftaranId END)',
        'terpakaiNonJkn',
      )
      .where('puh.tenantId = :tenantId', { tenantId })
      .andWhere('puh.tanggalKunjungan = :tanggal', { tanggal })
      .andWhere('puh.jadwalDokterId IN (:...jadwalIds)', { jadwalIds })
      .andWhere('puh.statusPenempatan IN (:...validPlacements)', {
        validPlacements: [
          StatusPenempatanUnit.AKTIF,
          StatusPenempatanUnit.SELESAI,
        ],
      })
      .andWhere('p.statusKunjungan != :batal', {
        batal: StatusKunjungan.BATAL,
      })
      .setParameter('bpjs', JenisPenjamin.BPJS)
      .groupBy('puh.jadwalDokterId')
      .getRawMany<JadwalUsageRawRow>();

    for (const row of rawRows) {
      map.set(Number(row.jadwalDokterId), {
        terpakaiTotal: Number(row.terpakaiTotal),
        terpakaiJkn: Number(row.terpakaiJkn),
        terpakaiNonJkn: Number(row.terpakaiNonJkn),
      });
    }

    return map;
  }

  private evaluateScheduleQuota(
    jadwal: Pick<JadwalDokter, 'kuotaJkn' | 'kuotaNonJkn' | 'kuotaTotal'>,
    usage: JadwalUsageStat,
    jenisPenjamin?: JenisPenjamin | string,
  ): {
    kuotaJkn: number;
    terpakaiJkn: number;
    sisaKuotaJkn: number | null;
    kuotaNonJkn: number;
    terpakaiNonJkn: number;
    sisaKuotaNonJkn: number | null;
    kuotaTotal: number;
    terpakaiTotal: number;
    sisaKuotaTotal: number | null;
    isUnlimited: boolean;
    isPenuh: boolean;
    alasanPenuh: string | null;
  } {
    const isUnlimited = jadwal.kuotaTotal === 0;
    const sisaKuotaTotal = isUnlimited
      ? null
      : Math.max(0, jadwal.kuotaTotal - usage.terpakaiTotal);
    const sisaKuotaJkn =
      jadwal.kuotaJkn > 0
        ? Math.max(0, jadwal.kuotaJkn - usage.terpakaiJkn)
        : null;
    const sisaKuotaNonJkn =
      jadwal.kuotaNonJkn > 0
        ? Math.max(0, jadwal.kuotaNonJkn - usage.terpakaiNonJkn)
        : null;

    let isPenuh = false;
    let alasanPenuh: string | null = null;

    if (!isUnlimited) {
      if (sisaKuotaTotal === 0) {
        isPenuh = true;
        alasanPenuh = `Kuota total jadwal dokter (${jadwal.kuotaTotal} pasien) sudah penuh.`;
      } else if (
        jenisPenjamin === JenisPenjamin.BPJS &&
        sisaKuotaJkn !== null &&
        sisaKuotaJkn === 0
      ) {
        isPenuh = true;
        alasanPenuh = `Kuota pasien JKN/BPJS pada jadwal ini (${jadwal.kuotaJkn} pasien) sudah penuh.`;
      } else if (
        jenisPenjamin &&
        jenisPenjamin !== String(JenisPenjamin.BPJS) &&
        sisaKuotaNonJkn !== null &&
        sisaKuotaNonJkn === 0
      ) {
        isPenuh = true;
        alasanPenuh = `Kuota pasien Non-JKN pada jadwal ini (${jadwal.kuotaNonJkn} pasien) sudah penuh.`;
      }
    }

    return {
      kuotaJkn: jadwal.kuotaJkn,
      terpakaiJkn: usage.terpakaiJkn,
      sisaKuotaJkn,
      kuotaNonJkn: jadwal.kuotaNonJkn,
      terpakaiNonJkn: usage.terpakaiNonJkn,
      sisaKuotaNonJkn,
      kuotaTotal: jadwal.kuotaTotal,
      terpakaiTotal: usage.terpakaiTotal,
      sisaKuotaTotal,
      isUnlimited,
      isPenuh,
      alasanPenuh,
    };
  }

  private async assertNoActiveInpatientForPatient(
    manager: EntityManager,
    tenantId: string,
    pasienId: number,
    excludePendaftaranId?: number,
  ): Promise<void> {
    const existing = await manager.findOne(Pendaftaran, {
      where: {
        tenantId,
        pasienId,
        jenisLayananSaatIni: In([...INPATIENT_LAYANAN_SET]),
        statusKunjungan: In([...ACTIVE_KUNJUNGAN_STATUSES]),
        ...(excludePendaftaranId ? { id: Not(excludePendaftaranId) } : {}),
      },
      select: ['id', 'noRegistrasi'],
    });

    if (existing) {
      throw new ConflictException(
        `Pasien masih memiliki kunjungan rawat inap aktif (${existing.noRegistrasi}).`,
      );
    }
  }

  private determineJenisPerpindahan(params: {
    currentlyInpatient: boolean;
    targetInpatient: boolean;
    currentUnitId: number;
    targetUnitId: number;
    currentBedId: number | null;
    targetBedId: number | null;
  }): JenisPerpindahanUnit {
    if (!params.currentlyInpatient && params.targetInpatient) {
      return JenisPerpindahanUnit.ADMISI_RANAP;
    }
    if (params.currentlyInpatient && params.targetInpatient) {
      if (params.currentUnitId !== params.targetUnitId) {
        return JenisPerpindahanUnit.MUTASI_RANAP;
      }
      if (params.currentBedId !== params.targetBedId) {
        return JenisPerpindahanUnit.PINDAH_BED;
      }
      return JenisPerpindahanUnit.GANTI_DPJP;
    }
    return JenisPerpindahanUnit.MUTASI_RAJAL;
  }

  private async generateNoRegistrasiInTransaction(
    manager: EntityManager,
    tenantId: string,
    tanggalKunjungan: string,
  ): Promise<string> {
    const yyyymmdd = tanggalKunjungan.replace(/-/g, '');
    const counterKey = `NO_REG_${yyyymmdd}`;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const seq = await this.incrementTenantCounter(
        manager,
        tenantId,
        counterKey,
      );
      const candidate = `REG-${yyyymmdd}-${String(seq).padStart(4, '0')}`;
      const collision = await manager.findOne(Pendaftaran, {
        where: { tenantId, noRegistrasi: candidate },
        select: ['id'],
      });
      if (!collision) {
        return candidate;
      }
    }

    throw new ConflictException(
      'Gagal menghasilkan Nomor Registrasi unik setelah beberapa percobaan.',
    );
  }

  private async incrementTenantCounter(
    manager: EntityManager,
    tenantId: string,
    counterKey: string,
  ): Promise<number> {
    const rawRows: unknown = await manager.query(
      `INSERT INTO tenant_counters (tenant_id, counter_key, last_value, created_at, updated_at)
       VALUES ($1, $2, 1, NOW(), NOW())
       ON CONFLICT (tenant_id, counter_key)
       DO UPDATE SET last_value = tenant_counters.last_value + 1, updated_at = NOW()
       RETURNING last_value`,
      [tenantId, counterKey],
    );
    const rows = rawRows as Array<{ last_value: string | number }>;
    return Number(rows[0].last_value);
  }

  private async savePendaftaranWithConstraintHandling(
    manager: EntityManager,
    entity: Pendaftaran,
  ): Promise<Pendaftaran> {
    try {
      return await manager.save(Pendaftaran, entity);
    } catch (error: unknown) {
      if (getPostgresErrorCode(error) === '23505') {
        throw new ConflictException(
          'Nomor registrasi atau status rawat inap aktif pasien terduplikasi pada tenant ini.',
        );
      }
      throw error;
    }
  }

  private assertTanggalBerlaku(
    berlakuSampai: string | null,
    tanggalKunjungan: string,
    label: string,
  ): void {
    if (berlakuSampai && berlakuSampai < tanggalKunjungan) {
      throw new BadRequestException(
        `${label} sudah kedaluwarsa per ${berlakuSampai} (tanggal kunjungan ${tanggalKunjungan}).`,
      );
    }
  }

  private enrichDokterDisplay(dokter: Dokter | null | undefined) {
    if (!dokter) return dokter ?? null;
    return {
      ...dokter,
      namaTampilan: formatNamaGelarDokter(
        dokter.gelarDepan,
        dokter.penduduk?.namaLengkap,
        dokter.gelarBelakang,
      ),
    };
  }

  private getCurrentUserId(): number | null {
    const raw = this.tenantService.getUserId();
    if (raw === undefined || raw === null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private getTodayDateString(): string {
    const timeZone = process.env.APP_TIMEZONE || 'Asia/Jakarta';
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date());
    } catch {
      return new Date().toISOString().slice(0, 10);
    }
  }
}
