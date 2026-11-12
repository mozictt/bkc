import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TenantContextService } from '@common/tenant/tenant-context.service';
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
import {
  HariPraktik,
  JenisKelamin,
  JenisPenjamin,
  JenisUnit,
  SesiPraktik,
  StatusAktifMaster,
  StatusKetersediaanBed,
} from '@src/master-simrs/constants/simrs.enum';
import { PasienService } from '@src/master-simrs/pasien/services/pasien.service';
import {
  CaraKeluarPasien,
  JenisLayananPendaftaran,
  JenisPerpindahanUnit,
  StatusKunjungan,
  StatusPenempatanUnit,
} from '../constants/pendaftaran.enum';
import { PendaftaranService } from './pendaftaran.service';

describe('PendaftaranService', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';
  const tanggalRabu = '2026-11-11'; // 2026-11-11 jatuh pada hari RABU

  const buildMockContext = () => {
    const savedHistoryList: Array<Record<string, unknown>> = [];
    const savedPenjaminList: Array<Record<string, unknown>> = [];
    const savedPasienPenjaminList: Array<Record<string, unknown>> = [];
    const savedBeds: Array<Record<string, unknown>> = [];
    let savedPendaftaran: Record<string, unknown> | null = null;

    const dupBookingQb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue(null),
    };

    const usageQb = {
      innerJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    let counterSeq = 0;

    const poliUmum: Partial<Unit> = {
      id: 1,
      kode: 'POLI-UMUM',
      nama: 'Poliklinik Umum',
      jenisUnit: JenisUnit.RAWAT_JALAN,
      kelasDefaultId: null,
      isTersediaBed: false,
      status: StatusAktifMaster.AKTIF,
      tenantId,
    };

    const poliDalam: Partial<Unit> = {
      id: 2,
      kode: 'POLI-PD',
      nama: 'Poliklinik Penyakit Dalam',
      jenisUnit: JenisUnit.RAWAT_JALAN,
      kelasDefaultId: null,
      isTersediaBed: false,
      status: StatusAktifMaster.AKTIF,
      tenantId,
    };

    const bangsalMelati: Partial<Unit> = {
      id: 3,
      kode: 'R-MELATI',
      nama: 'Bangsal Melati',
      jenisUnit: JenisUnit.RAWAT_INAP,
      kelasDefaultId: 2,
      isTersediaBed: true,
      status: StatusAktifMaster.AKTIF,
      tenantId,
    };

    const igdUnit: Partial<Unit> = {
      id: 4,
      kode: 'IGD',
      nama: 'Instalasi Gawat Darurat',
      jenisUnit: JenisUnit.IGD,
      kelasDefaultId: null,
      isTersediaBed: true,
      status: StatusAktifMaster.AKTIF,
      tenantId,
    };

    const jadwalUmumRabu: Partial<JadwalDokter> = {
      id: 10,
      dokterId: 100,
      unitId: 1,
      hari: HariPraktik.RABU,
      hariUrutan: 3,
      jamMulai: '08:00',
      jamSelesai: '12:00',
      sesi: SesiPraktik.PAGI,
      kuotaJkn: 10,
      kuotaNonJkn: 10,
      kuotaTotal: 20,
      durasiPerPasien: 15,
      status: StatusAktifMaster.AKTIF,
      tenantId,
    };

    const jadwalDalamRabu: Partial<JadwalDokter> = {
      id: 11,
      dokterId: 101,
      unitId: 2,
      hari: HariPraktik.RABU,
      hariUrutan: 3,
      jamMulai: '09:00',
      jamSelesai: '13:00',
      sesi: SesiPraktik.PAGI,
      kuotaJkn: 5,
      kuotaNonJkn: 5,
      kuotaTotal: 10,
      durasiPerPasien: 20,
      status: StatusAktifMaster.AKTIF,
      tenantId,
    };

    const dokter100: Partial<Dokter> = {
      id: 100,
      kodeDokter: 'DOK-100',
      status: StatusAktifMaster.AKTIF,
      tenantId,
    };

    const dokter101: Partial<Dokter> = {
      id: 101,
      kodeDokter: 'DOK-101',
      status: StatusAktifMaster.AKTIF,
      tenantId,
    };

    const bed201: Partial<Bed> = {
      id: 201,
      kode: 'MLT-01',
      nama: 'Bed 01',
      unitId: 3,
      kelasId: 2,
      statusKetersediaan: StatusKetersediaanBed.KOSONG,
      status: StatusAktifMaster.AKTIF,
      tenantId,
    };

    const bed202: Partial<Bed> = {
      id: 202,
      kode: 'MLT-02',
      nama: 'Bed 02',
      unitId: 3,
      kelasId: 2,
      statusKetersediaan: StatusKetersediaanBed.KOSONG,
      status: StatusAktifMaster.AKTIF,
      tenantId,
    };

    const masterBpjs: Partial<Penjamin> = {
      id: 2,
      kode: 'BPJS',
      nama: 'BPJS Kesehatan',
      jenisPenjamin: JenisPenjamin.BPJS,
      butuhNoKartu: true,
      pksBerlakuSampai: '2030-12-31',
      status: StatusAktifMaster.AKTIF,
      tenantId,
    };

    const masterSwasta: Partial<Penjamin> = {
      id: 3,
      kode: 'PRU',
      nama: 'Prudential Indonesia',
      jenisPenjamin: JenisPenjamin.ASURANSI_SWASTA,
      butuhNoKartu: true,
      pksBerlakuSampai: '2030-12-31',
      status: StatusAktifMaster.AKTIF,
      tenantId,
    };

    const manager = {
      findOne: jest.fn((entity: unknown, options?: { where?: unknown }) => {
        const where = options?.where as Record<string, unknown> | undefined;
        if (entity === Pasien) {
          return Promise.resolve({
            id: 50,
            noRm: '00000050',
            status: StatusAktifMaster.AKTIF,
            tenantId,
          });
        }
        if (entity === Penjamin) {
          if (
            where &&
            !Array.isArray(where) &&
            where.jenisPenjamin === JenisPenjamin.UMUM
          ) {
            return Promise.resolve(null);
          }
          if (Array.isArray(where)) {
            const first = where[0] as Record<string, unknown>;
            if (first.id === 2) return Promise.resolve({ ...masterBpjs });
            if (first.id === 3) return Promise.resolve({ ...masterSwasta });
            return Promise.resolve(null);
          }
          return Promise.resolve({ ...masterBpjs });
        }
        if (entity === PasienPenjamin) {
          if (where && where.id === 301) {
            return Promise.resolve({
              id: 301,
              pasienId: 50,
              penjaminId: 2,
              noKartu: '0001234567890',
              kelasHakId: 2,
              berlakuSampai: '2029-12-31',
              status: StatusAktifMaster.AKTIF,
              penjamin: { ...masterBpjs },
            });
          }
          if (where && where.isUtama === true) {
            return Promise.resolve(
              savedPasienPenjaminList.find((item) => item.isUtama === true) ??
                null,
            );
          }
          if (where && typeof where.penjaminId === 'number') {
            return Promise.resolve(
              savedPasienPenjaminList.find(
                (item) =>
                  item.penjaminId === where.penjaminId &&
                  item.noKartu === where.noKartu,
              ) ?? null,
            );
          }
          return Promise.resolve(null);
        }
        if (entity === Unit) {
          const id = where?.id;
          if (id === 1) return Promise.resolve({ ...poliUmum });
          if (id === 2) return Promise.resolve({ ...poliDalam });
          if (id === 3) return Promise.resolve({ ...bangsalMelati });
          if (id === 4) return Promise.resolve({ ...igdUnit });
          return Promise.resolve(null);
        }
        if (entity === JadwalDokter) {
          const id = where?.id;
          if (id === 10) return Promise.resolve({ ...jadwalUmumRabu });
          if (id === 11) return Promise.resolve({ ...jadwalDalamRabu });
          return Promise.resolve(null);
        }
        if (entity === Dokter) {
          const id = where?.id;
          if (id === 100) return Promise.resolve({ ...dokter100 });
          if (id === 101) return Promise.resolve({ ...dokter101 });
          return Promise.resolve(null);
        }
        if (entity === Bed) {
          const id = where?.id;
          if (id === 201) return Promise.resolve({ ...bed201 });
          if (id === 202) return Promise.resolve({ ...bed202 });
          return Promise.resolve(null);
        }
        if (entity === Pendaftaran) {
          if (typeof where?.id === 'number') {
            return Promise.resolve(savedPendaftaran);
          }
          return Promise.resolve(null);
        }
        if (entity === PendaftaranUnitHistory) {
          return Promise.resolve(
            savedHistoryList[savedHistoryList.length - 1] ?? null,
          );
        }
        return Promise.resolve(null);
      }),
      find: jest.fn((entity: unknown) => {
        if (entity === PendaftaranUnitHistory) {
          return Promise.resolve([...savedHistoryList].reverse());
        }
        return Promise.resolve([]);
      }),
      query: jest.fn(() => {
        counterSeq += 1;
        return Promise.resolve([{ last_value: String(counterSeq) }]);
      }),
      create: jest.fn((_entity: unknown, payload: Record<string, unknown>) => ({
        ...payload,
      })),
      save: jest.fn((entity: unknown, payload: Record<string, unknown>) => {
        if (entity === Pendaftaran) {
          savedPendaftaran = { id: 700, ...payload };
          return Promise.resolve(savedPendaftaran);
        }
        if (entity === PendaftaranUnitHistory) {
          const rec = { id: 800 + savedHistoryList.length, ...payload };
          const idx = savedHistoryList.findIndex((h) => h.id === rec.id);
          if (idx >= 0) {
            savedHistoryList[idx] = rec;
          } else {
            savedHistoryList.push(rec);
          }
          return Promise.resolve(rec);
        }
        if (entity === Bed) {
          savedBeds.push({ ...payload });
          if (payload.id === 201)
            bed201.statusKetersediaan = payload.statusKetersediaan as string;
          if (payload.id === 202)
            bed202.statusKetersediaan = payload.statusKetersediaan as string;
          return Promise.resolve(payload);
        }
        if (entity === PasienPenjamin) {
          const rec = {
            id: 302 + savedPasienPenjaminList.length,
            ...payload,
          };
          savedPasienPenjaminList.push(rec);
          return Promise.resolve(rec);
        }
        if (entity === PendaftaranPenjamin) {
          const items = Array.isArray(payload) ? payload : [payload];
          const savedRows = items.map((item) => {
            const rec = {
              id: 900 + savedPenjaminList.length,
              ...item,
            };
            savedPenjaminList.push(rec);
            return rec;
          });
          return Promise.resolve(
            Array.isArray(payload) ? savedRows : savedRows[0],
          );
        }
        return Promise.resolve({ id: 1, ...payload });
      }),
      delete: jest.fn((entity: unknown) => {
        if (entity === PendaftaranPenjamin) {
          savedPenjaminList.length = 0;
        }
        return Promise.resolve({ affected: 1 });
      }),
      createQueryBuilder: jest.fn((_entity: unknown, alias: string) => {
        if (alias === 'puh') {
          const calls = dupBookingQb.getRawOne.mock.calls.length;
          void calls;
          return {
            ...usageQb,
            getRawOne: dupBookingQb.getRawOne,
          };
        }
        return usageQb;
      }),
    };

    const detailQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn(() =>
        Promise.resolve({
          ...(savedPendaftaran ?? {
            id: 700,
            noRegistrasi: 'REG-20261111-0001',
          }),
          dokterSaatIni: {
            id: 100,
            gelarDepan: 'dr.',
            gelarBelakang: 'Sp.PD',
            penduduk: { namaLengkap: 'Budi Santoso' },
          },
        }),
      ),
    };

    const historyQb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn(() =>
        Promise.resolve(
          savedHistoryList.map((h) => ({
            ...h,
            waktuMasuk: h.waktuMasuk ?? new Date('2026-11-11T02:00:00Z'),
            waktuKeluar: h.waktuKeluar ?? null,
            dokterAsal: null,
            dokterTujuan: {
              id: h.dokterTujuanId,
              gelarDepan: 'dr.',
              gelarBelakang: null,
              penduduk: { namaLengkap: 'Andi Wijaya' },
            },
          })),
        ),
      ),
    };

    const jadwalFindQb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          ...jadwalUmumRabu,
          dokter: {
            id: 100,
            kodeDokter: 'DOK-100',
            gelarDepan: 'dr.',
            gelarBelakang: null,
            penduduk: { id: 1, namaLengkap: 'Andi Wijaya' },
          },
          unit: { ...poliUmum },
        },
      ]),
    };

    const repo = {
      createQueryBuilder: jest.fn(() => detailQb),
      findOneBy: jest.fn().mockResolvedValue({ id: 700, tenantId }),
    };
    const historyRepo = {
      createQueryBuilder: jest.fn(() => historyQb),
    };
    const pendaftaranPenjaminRepo = {
      find: jest.fn(() =>
        Promise.resolve(
          [...savedPenjaminList].sort(
            (a, b) => Number(a.urutan ?? 1) - Number(b.urutan ?? 1),
          ),
        ),
      ),
    };
    const jadwalRepo = {
      createQueryBuilder: jest.fn(() => jadwalFindQb),
    };
    const dataSource = {
      manager,
      transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
        cb(manager),
      ),
    };
    const pasienService = {
      createInTransaction: jest.fn().mockResolvedValue({
        id: 55,
        noRm: '00000055',
        status: StatusAktifMaster.AKTIF,
      }),
    };
    const tenantService = {
      getTenantId: jest.fn(() => tenantId),
      getUserId: jest.fn(() => 7),
    };

    const service = new PendaftaranService(
      repo as unknown as Repository<Pendaftaran>,
      historyRepo as unknown as Repository<PendaftaranUnitHistory>,
      pendaftaranPenjaminRepo as unknown as Repository<PendaftaranPenjamin>,
      jadwalRepo as unknown as Repository<JadwalDokter>,
      dataSource as unknown as DataSource,
      pasienService as unknown as PasienService,
      tenantService as unknown as TenantContextService,
    );

    return {
      service,
      manager,
      usageQb,
      dupBookingQb,
      pasienService,
      bed201,
      bed202,
      savedHistoryList,
      savedPenjaminList,
      savedPasienPenjaminList,
      savedBeds,
      setSavedPendaftaran: (val: Record<string, unknown>) => {
        savedPendaftaran = val;
      },
      getSavedPendaftaran: () => savedPendaftaran,
    };
  };

  it('mendaftarkan pasien baru terpadu dengan cara bayar UMUM dan jadwal praktik dokter (membuat history urutan 1 + antrean)', async () => {
    const { service, pasienService, savedHistoryList, getSavedPendaftaran } =
      buildMockContext();

    const result = await service.create({
      pasienBaru: {
        penduduk: {
          nik: '3273010101900001',
          namaLengkap: 'Dewi Lestari',
          jenisKelamin: JenisKelamin.PEREMPUAN,
        },
      },
      tanggalKunjungan: tanggalRabu,
      unitId: 1,
      jadwalDokterId: 10,
      jenisPenjamin: JenisPenjamin.UMUM,
    });

    expect(pasienService.createInTransaction).toHaveBeenCalledTimes(1);
    expect(getSavedPendaftaran()).toEqual(
      expect.objectContaining({
        pasienId: 55,
        jenisPenjamin: JenisPenjamin.UMUM,
        namaPenjaminSnapshot: 'Umum / Pribadi',
        unitSaatIniId: 1,
        dokterSaatIniId: 100,
        jadwalDokterSaatIniId: 10,
        jenisLayananSaatIni: JenisLayananPendaftaran.RAWAT_JALAN,
        statusKunjungan: StatusKunjungan.TERDAFTAR,
        createdById: 7,
      }),
    );
    expect(savedHistoryList).toHaveLength(1);
    expect(savedHistoryList[0]).toEqual(
      expect.objectContaining({
        urutan: 1,
        jenisPerpindahan: JenisPerpindahanUnit.PENDAFTARAN_AWAL,
        unitTujuanId: 1,
        jadwalDokterId: 10,
        statusPenempatan: StatusPenempatanUnit.AKTIF,
      }),
    );
    expect(result.historyUnit).toHaveLength(1);
    expect(result.historyUnit[0].dokterTujuan?.namaTampilan).toBe(
      'dr. Andi Wijaya',
    );
  });

  it('menolak pendaftaran rawat jalan jika tanggal kunjungan tidak cocok dengan hari jadwal praktik dokter', async () => {
    const { service } = buildMockContext();

    await expect(
      service.create({
        pasienId: 50,
        tanggalKunjungan: '2026-11-12', // Kamis, sedangkan jadwal 10 adalah RABU
        unitId: 1,
        jadwalDokterId: 10,
        jenisPenjamin: JenisPenjamin.UMUM,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('menolak pendaftaran jika kuota JKN/BPJS pada jadwal dokter sudah penuh', async () => {
    const { service, usageQb } = buildMockContext();
    usageQb.getRawMany.mockResolvedValue([
      {
        jadwalDokterId: 10,
        terpakaiTotal: '12',
        terpakaiJkn: '10', // kuotaJkn = 10 -> penuh
        terpakaiNonJkn: '2',
      },
    ]);

    await expect(
      service.create({
        pasienId: 50,
        tanggalKunjungan: tanggalRabu,
        unitId: 1,
        jadwalDokterId: 10,
        pasienPenjaminId: 301,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('mendukung mutasi Rajal -> Rajal dengan memotong kuota poli tujuan, mendapat antrean baru, dan mencatat history perpindahan', async () => {
    const { service, savedHistoryList, getSavedPendaftaran } =
      buildMockContext();

    await service.create({
      pasienId: 50,
      tanggalKunjungan: tanggalRabu,
      unitId: 1,
      jadwalDokterId: 10,
      pasienPenjaminId: 301,
    });

    const mutated = await service.mutasi(700, {
      unitTujuanId: 2,
      jadwalDokterId: 11,
      tanggalMutasi: tanggalRabu,
      alasan: 'Konsul ke Poli Penyakit Dalam',
    });

    expect(getSavedPendaftaran()).toEqual(
      expect.objectContaining({
        unitSaatIniId: 2,
        dokterSaatIniId: 101,
        jadwalDokterSaatIniId: 11,
        jenisLayananSaatIni: JenisLayananPendaftaran.RAWAT_JALAN,
        statusKunjungan: StatusKunjungan.DALAM_PELAYANAN,
      }),
    );
    expect(savedHistoryList).toHaveLength(2);
    expect(savedHistoryList[0].statusPenempatan).toBe(
      StatusPenempatanUnit.SELESAI,
    );
    expect(savedHistoryList[1]).toEqual(
      expect.objectContaining({
        urutan: 2,
        jenisPerpindahan: JenisPerpindahanUnit.MUTASI_RAJAL,
        unitAsalId: 1,
        unitTujuanId: 2,
        jadwalDokterId: 11,
        statusPenempatan: StatusPenempatanUnit.AKTIF,
      }),
    );
    expect(savedHistoryList[1].noAntrean).toBeTruthy();
    expect(mutated.historyUnit).toHaveLength(2);
  });

  it('mendukung mutasi IGD -> Ranap -> Pindah Bed Ranap dan mengosongkan bed lama ke KOSONG', async () => {
    const { service, bed201, bed202, savedHistoryList, getSavedPendaftaran } =
      buildMockContext();

    await service.create({
      pasienId: 50,
      tanggalKunjungan: tanggalRabu,
      unitId: 4, // IGD
      dokterId: 100,
      jenisPenjamin: JenisPenjamin.UMUM,
    });

    // Mutasi IGD -> Bangsal Melati Bed 201
    await service.mutasi(700, {
      unitTujuanId: 3,
      dokterTujuanId: 101,
      bedTujuanId: 201,
      alasan: 'Indikasi rawat inap',
    });

    expect(bed201.statusKetersediaan).toBe(StatusKetersediaanBed.TERISI);
    expect(getSavedPendaftaran()?.statusKunjungan).toBe(
      StatusKunjungan.DIRAWAT,
    );

    // Pindah Bed 201 -> Bed 202
    await service.mutasi(700, {
      unitTujuanId: 3,
      dokterTujuanId: 101,
      bedTujuanId: 202,
      alasan: 'Pindah ke bed dekat nurse station',
    });

    expect(bed201.statusKetersediaan).toBe(StatusKetersediaanBed.KOSONG);
    expect(bed202.statusKetersediaan).toBe(StatusKetersediaanBed.TERISI);
    expect(savedHistoryList).toHaveLength(3);
    expect(savedHistoryList[1].jenisPerpindahan).toBe(
      JenisPerpindahanUnit.ADMISI_RANAP,
    );
    expect(savedHistoryList[2].jenisPerpindahan).toBe(
      JenisPerpindahanUnit.PINDAH_BED,
    );
  });

  it('menolak mutasi dari Rawat Inap kembali ke Rawat Jalan (harus menggunakan Batal Ranap)', async () => {
    const { service } = buildMockContext();

    await service.create({
      pasienId: 50,
      tanggalKunjungan: tanggalRabu,
      unitId: 3, // Langsung Ranap
      dokterId: 101,
      bedId: 201,
      jenisPenjamin: JenisPenjamin.UMUM,
    });

    await expect(
      service.mutasi(700, {
        unitTujuanId: 1, // Poli Umum (Rajal)
        jadwalDokterId: 10,
        tanggalMutasi: tanggalRabu,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('memproses Batal Ranap dari admisi IGD: mengosongkan bed -> KOSONG dan mengembalikan ke unit IGD asal', async () => {
    const { service, bed201, savedHistoryList, getSavedPendaftaran } =
      buildMockContext();

    await service.create({
      pasienId: 50,
      tanggalKunjungan: tanggalRabu,
      unitId: 4, // IGD
      dokterId: 100,
      jenisPenjamin: JenisPenjamin.UMUM,
    });

    await service.mutasi(700, {
      unitTujuanId: 3, // Ranap
      dokterTujuanId: 101,
      bedTujuanId: 201,
    });

    expect(bed201.statusKetersediaan).toBe(StatusKetersediaanBed.TERISI);

    await service.batalRanap(700, {
      alasan: 'Keluarga menolak rawat inap',
    });

    expect(bed201.statusKetersediaan).toBe(StatusKetersediaanBed.KOSONG);
    expect(getSavedPendaftaran()).toEqual(
      expect.objectContaining({
        jenisLayananSaatIni: JenisLayananPendaftaran.IGD,
        unitSaatIniId: 4,
        dokterSaatIniId: 100,
        bedSaatIniId: null,
        statusKunjungan: StatusKunjungan.DALAM_PELAYANAN,
      }),
    );
    expect(savedHistoryList).toHaveLength(3);
    expect(savedHistoryList[1].statusPenempatan).toBe(
      StatusPenempatanUnit.BATAL,
    );
    expect(savedHistoryList[2]).toEqual(
      expect.objectContaining({
        urutan: 3,
        jenisPerpindahan: JenisPerpindahanUnit.BATAL_RANAP,
        unitTujuanId: 4,
        statusPenempatan: StatusPenempatanUnit.AKTIF,
      }),
    );
  });

  it('mengosongkan bed menjadi KOSONG saat pasien pulang / discharge (selesai)', async () => {
    const { service, bed201, savedHistoryList, getSavedPendaftaran } =
      buildMockContext();

    await service.create({
      pasienId: 50,
      tanggalKunjungan: tanggalRabu,
      unitId: 3,
      dokterId: 101,
      bedId: 201,
      jenisPenjamin: JenisPenjamin.UMUM,
    });

    expect(bed201.statusKetersediaan).toBe(StatusKetersediaanBed.TERISI);

    await service.selesai(700, {
      caraKeluar: CaraKeluarPasien.PULANG_SEMBUH,
      catatan: 'Kontrol 7 hari lagi',
    });

    expect(bed201.statusKetersediaan).toBe(StatusKetersediaanBed.KOSONG);
    expect(getSavedPendaftaran()?.statusKunjungan).toBe(
      StatusKunjungan.SELESAI,
    );
    expect(savedHistoryList[0].statusPenempatan).toBe(
      StatusPenempatanUnit.SELESAI,
    );
  });

  it('menghitung sisa kuota jadwal dokter tersedia dalam 1 query agregasi tanpa N+1', async () => {
    const { service, usageQb } = buildMockContext();
    usageQb.getRawMany.mockResolvedValue([
      {
        jadwalDokterId: 10,
        terpakaiTotal: '6',
        terpakaiJkn: '4',
        terpakaiNonJkn: '2',
      },
    ]);

    const options = await service.findJadwalDokterTersedia({
      tanggal: tanggalRabu,
      jenisPenjamin: JenisPenjamin.BPJS,
    });

    expect(options).toHaveLength(1);
    expect(options[0].kuotaInfo).toEqual(
      expect.objectContaining({
        terpakaiJkn: 4,
        sisaKuotaJkn: 6,
        terpakaiNonJkn: 2,
        sisaKuotaNonJkn: 8,
        terpakaiTotal: 6,
        sisaKuotaTotal: 14,
        isPenuh: false,
      }),
    );
  });

  it('mendukung multi-penjamin COB pada 1 pendaftaran, mencerminkan penjamin utama di pendaftaran, dan menyimpan kartu baru ke profil tanpa bentrok isUtama', async () => {
    const {
      service,
      savedPenjaminList,
      savedPasienPenjaminList,
      getSavedPendaftaran,
    } = buildMockContext();

    const result = await service.create({
      pasienId: 50,
      tanggalKunjungan: tanggalRabu,
      unitId: 1,
      jadwalDokterId: 10,
      penjaminList: [
        {
          urutan: 2,
          isUtama: false,
          penjaminId: 3, // Prudential (sekunder, urut input kedua walau ditulis pertama)
          noKartu: 'PRU-889900',
          simpanKeProfilPasien: true,
          keterangan: 'COB selisih kelas VIP',
        },
        {
          urutan: 1,
          isUtama: true,
          penjaminId: 2, // BPJS (utama)
          noKartu: '0009998887771',
          noSep: '0101R0011126V000099',
          noRujukan: '010101011126P000011',
          simpanKeProfilPasien: true,
        },
      ],
    });

    // Kolom flat di tabel pendaftaran mencerminkan penjamin utama (BPJS)
    expect(getSavedPendaftaran()).toEqual(
      expect.objectContaining({
        jenisPenjamin: JenisPenjamin.BPJS,
        penjaminId: 2,
        namaPenjaminSnapshot: 'BPJS Kesehatan',
        noKartuSnapshot: '0009998887771',
        noSep: '0101R0011126V000099',
        noRujukan: '010101011126P000011',
      }),
    );

    // Profil pasien_penjamin hanya menetapkan 1 kartu isUtama = true (milik penjamin utama)
    expect(savedPasienPenjaminList).toHaveLength(2);
    expect(
      savedPasienPenjaminList.filter((item) => item.isUtama === true),
    ).toHaveLength(1);
    expect(savedPasienPenjaminList[0]).toEqual(
      expect.objectContaining({
        penjaminId: 2,
        isUtama: true,
      }),
    );
    expect(savedPasienPenjaminList[1]).toEqual(
      expect.objectContaining({
        penjaminId: 3,
        isUtama: false,
      }),
    );

    // Snapshot pendaftaran_penjamin terurut urutan=1 (Utama) -> urutan=2 (COB)
    expect(savedPenjaminList).toHaveLength(2);
    expect(result.penjaminList).toHaveLength(2);
    expect(result.penjaminList[0]).toEqual(
      expect.objectContaining({
        urutan: 1,
        isUtama: true,
        penjaminId: 2,
        noSep: '0101R0011126V000099',
      }),
    );
    expect(result.penjaminList[1]).toEqual(
      expect.objectContaining({
        urutan: 2,
        isUtama: false,
        penjaminId: 3,
        noKartuSnapshot: 'PRU-889900',
        keterangan: 'COB selisih kelas VIP',
      }),
    );
  });

  it('menolak penggabungan UMUM dengan asuransi lain, kartu ganda, serta lebih dari satu penjamin utama', async () => {
    const { service } = buildMockContext();

    await expect(
      service.create({
        pasienId: 50,
        tanggalKunjungan: tanggalRabu,
        unitId: 4,
        dokterId: 100,
        penjaminList: [
          { isUtama: true, jenisPenjamin: JenisPenjamin.UMUM },
          { isUtama: false, penjaminId: 2, noKartu: '0001234567890' },
        ],
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.create({
        pasienId: 50,
        tanggalKunjungan: tanggalRabu,
        unitId: 4,
        dokterId: 100,
        penjaminList: [
          { isUtama: true, pasienPenjaminId: 301 },
          { isUtama: false, pasienPenjaminId: 301 },
        ],
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.create({
        pasienId: 50,
        tanggalKunjungan: tanggalRabu,
        unitId: 4,
        dokterId: 100,
        penjaminList: [
          { isUtama: true, penjaminId: 2, noKartu: '0001' },
          { isUtama: true, penjaminId: 3, noKartu: 'PRU-1' },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('memperbarui daftar penjamin kunjungan aktif via updatePenjamin dan memvalidasi kuota jika pindah ke JKN pada Rajal', async () => {
    const { service, usageQb, savedPenjaminList, getSavedPendaftaran } =
      buildMockContext();

    await service.create({
      pasienId: 50,
      tanggalKunjungan: tanggalRabu,
      unitId: 1,
      jadwalDokterId: 10,
      jenisPenjamin: JenisPenjamin.UMUM,
    });

    // Kuota JKN penuh (10/10) -> perubahan dari UMUM ke BPJS harus ditolak
    usageQb.getRawMany.mockResolvedValueOnce([
      {
        jadwalDokterId: 10,
        terpakaiTotal: '12',
        terpakaiJkn: '10',
        terpakaiNonJkn: '2',
      },
    ]);

    await expect(
      service.updatePenjamin(700, {
        penjaminList: [
          { isUtama: true, penjaminId: 2, noKartu: '0001234567890' },
        ],
      }),
    ).rejects.toThrow(ConflictException);

    // Kuota JKN tersedia (4/10) -> perubahan ke BPJS + Prudential COB berhasil
    usageQb.getRawMany.mockResolvedValueOnce([
      {
        jadwalDokterId: 10,
        terpakaiTotal: '6',
        terpakaiJkn: '4',
        terpakaiNonJkn: '2',
      },
    ]);

    const updated = await service.updatePenjamin(700, {
      penjaminList: [
        {
          isUtama: true,
          pasienPenjaminId: 301,
          noSep: 'SEP-BARU-01',
        },
        {
          isUtama: false,
          penjaminId: 3,
          noKartu: 'PRU-COB-02',
        },
      ],
    });

    expect(getSavedPendaftaran()).toEqual(
      expect.objectContaining({
        jenisPenjamin: JenisPenjamin.BPJS,
        penjaminId: 2,
        noSep: 'SEP-BARU-01',
      }),
    );
    expect(savedPenjaminList).toHaveLength(2);
    expect(updated.penjaminList).toHaveLength(2);
    expect(updated.penjaminList[1].penjaminId).toBe(3);
  });
});
