import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { JadwalDokter } from '@entities/jadwal-dokter.entity';
import { Dokter } from '@entities/dokter.entity';
import { Unit } from '@entities/unit.entity';
import {
  HariPraktik,
  SesiPraktik,
  StatusAktifMaster,
} from '../../constants/simrs.enum';
import { JadwalDokterService } from './jadwal-dokter.service';

describe('JadwalDokterService', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';

  const createService = () => {
    const overlapQb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };

    const manager = {
      findOne: jest.fn(
        (entity: unknown): Promise<Record<string, unknown> | null> => {
          if (entity === Dokter) {
            return Promise.resolve({
              id: 1,
              kodeDokter: 'DOK-001',
              status: StatusAktifMaster.AKTIF,
              tenantId,
            });
          }
          if (entity === Unit) {
            return Promise.resolve({
              id: 2,
              kode: 'POLI-INT',
              nama: 'Poli Penyakit Dalam',
              status: StatusAktifMaster.AKTIF,
              tenantId,
            });
          }
          if (entity === JadwalDokter) {
            return Promise.resolve({
              id: 100,
              dokterId: 1,
              unitId: 2,
              hari: HariPraktik.SENIN,
              hariUrutan: 1,
              jamMulai: '08:00',
              jamSelesai: '12:00',
              sesi: SesiPraktik.PAGI,
              ruangan: 'Poli 1',
              kuotaJkn: 20,
              kuotaNonJkn: 10,
              kuotaTotal: 30,
              durasiPerPasien: 15,
              kodeJadwalBpjs: null,
              ihsScheduleId: null,
              keterangan: null,
              status: StatusAktifMaster.AKTIF,
              tenantId,
            });
          }
          return Promise.resolve(null);
        },
      ),
      create: jest.fn((_entity: unknown, payload: Record<string, unknown>) => ({
        id: 100,
        ...payload,
      })),
      save: jest.fn((_entity: unknown, entityOrList: unknown) => {
        if (Array.isArray(entityOrList)) {
          return Promise.resolve(
            entityOrList.map((item, idx) => ({
              ...(item as Record<string, unknown>),
              id: 100 + idx,
            })),
          );
        }
        return Promise.resolve({
          id: 100,
          ...(entityOrList as Record<string, unknown>),
        });
      }),
      createQueryBuilder: jest.fn(() => overlapQb),
    };

    const sampleRow = {
      id: 100,
      dokterId: 1,
      unitId: 2,
      hari: HariPraktik.SENIN,
      hariUrutan: 1,
      jamMulai: '08:00',
      jamSelesai: '12:00',
      sesi: SesiPraktik.PAGI,
      ruangan: 'Poli 1',
      kuotaJkn: 20,
      kuotaNonJkn: 10,
      kuotaTotal: 30,
      durasiPerPasien: 15,
      status: StatusAktifMaster.AKTIF,
      dokter: {
        id: 1,
        kodeDokter: 'DOK-001',
        gelarDepan: 'dr.',
        gelarBelakang: 'Sp.PD',
        penduduk: { id: 10, namaLengkap: 'Budi Santoso' },
      },
      unit: {
        id: 2,
        kode: 'POLI-INT',
        nama: 'Poli Penyakit Dalam',
      },
    };

    const readQb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(sampleRow),
      getMany: jest.fn().mockResolvedValue([sampleRow]),
      getManyAndCount: jest.fn().mockResolvedValue([[sampleRow], 1]),
    };

    const repo = {
      createQueryBuilder: jest.fn(() => readQb),
      findOneBy: jest.fn().mockResolvedValue(sampleRow),
      remove: jest.fn().mockResolvedValue(sampleRow),
    };

    const dataSource = {
      transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
        cb(manager),
      ),
    };

    const tenantService = {
      getTenantId: jest.fn(() => tenantId),
    };

    const service = new JadwalDokterService(
      repo as unknown as Repository<JadwalDokter>,
      dataSource as unknown as DataSource,
      tenantService as unknown as TenantContextService,
    );

    return {
      service,
      repo,
      manager,
      overlapQb,
      readQb,
      sampleRow,
    };
  };

  it('berhasil membuat jadwal dokter dengan auto-hitung kuotaTotal dan enrich namaTampilan + estimasiSlot', async () => {
    const { service, manager } = createService();

    const result = await service.create({
      dokterId: 1,
      unitId: 2,
      hari: HariPraktik.SENIN,
      jamMulai: '08:00',
      jamSelesai: '12:00',
      sesi: SesiPraktik.PAGI,
      ruangan: 'Poli 1',
      kuotaJkn: 20,
      kuotaNonJkn: 10,
      durasiPerPasien: 15,
    });

    expect(manager.save).toHaveBeenCalledWith(
      JadwalDokter,
      expect.objectContaining({
        dokterId: 1,
        unitId: 2,
        hari: HariPraktik.SENIN,
        hariUrutan: 1,
        kuotaTotal: 30,
        tenantId,
      }),
    );
    expect(result.dokter?.namaTampilan).toBe('dr. Budi Santoso, Sp.PD');
    expect(result.hariLabel).toBe('Senin');
    expect(result.estimasiSlot).toBe(16);
  });

  it('menolak jika jam selesai lebih awal atau sama dengan jam mulai', async () => {
    const { service } = createService();

    await expect(
      service.create({
        dokterId: 1,
        unitId: 2,
        hari: HariPraktik.SENIN,
        jamMulai: '12:00',
        jamSelesai: '08:00',
      }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.create({
        dokterId: 1,
        unitId: 2,
        hari: HariPraktik.SENIN,
        jamMulai: '08:00',
        jamSelesai: '08:00',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('menolak jika durasi per pasien melebihi durasi sesi praktik', async () => {
    const { service } = createService();

    await expect(
      service.create({
        dokterId: 1,
        unitId: 2,
        hari: HariPraktik.SELASA,
        jamMulai: '08:00',
        jamSelesai: '08:30',
        durasiPerPasien: 45,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('menolak jika kuotaJkn + kuotaNonJkn melebihi kuotaTotal', async () => {
    const { service } = createService();

    await expect(
      service.create({
        dokterId: 1,
        unitId: 2,
        hari: HariPraktik.RABU,
        jamMulai: '08:00',
        jamSelesai: '12:00',
        kuotaJkn: 20,
        kuotaNonJkn: 15,
        kuotaTotal: 30,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('menolak jika dokter atau unit sedang nonaktif', async () => {
    const { service, manager } = createService();
    manager.findOne.mockImplementation((entity: unknown) => {
      if (entity === Dokter) {
        return Promise.resolve({
          id: 1,
          status: StatusAktifMaster.NONAKTIF,
          tenantId,
        });
      }
      return Promise.resolve(null);
    });

    await expect(
      service.create({
        dokterId: 1,
        unitId: 2,
        hari: HariPraktik.KAMIS,
        jamMulai: '08:00',
        jamSelesai: '12:00',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('menolak jika jadwal bentrok (overlap) dengan jadwal aktif dokter pada hari yang sama', async () => {
    const { service, overlapQb } = createService();
    overlapQb.getMany.mockResolvedValue([
      {
        id: 55,
        hari: HariPraktik.SENIN,
        jamMulai: '09:00',
        jamSelesai: '13:00',
        unitId: 3,
        unit: { id: 3, nama: 'Poli Eksekutif' },
      },
    ]);

    await expect(
      service.create({
        dokterId: 1,
        unitId: 2,
        hari: HariPraktik.SENIN,
        jamMulai: '08:00',
        jamSelesai: '12:00',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('berhasil membuat jadwal beberapa hari sekaligus (bulkCreate) dalam 1 batch', async () => {
    const { service, manager, readQb, sampleRow } = createService();
    readQb.getMany.mockResolvedValue([
      sampleRow,
      { ...sampleRow, id: 101, hari: HariPraktik.RABU, hariUrutan: 3 },
      { ...sampleRow, id: 102, hari: HariPraktik.JUMAT, hariUrutan: 5 },
    ]);

    const result = await service.bulkCreate({
      dokterId: 1,
      unitId: 2,
      hariList: [HariPraktik.SENIN, HariPraktik.RABU, HariPraktik.JUMAT],
      jamMulai: '08:00',
      jamSelesai: '12:00',
      kuotaJkn: 15,
      kuotaNonJkn: 5,
    });

    expect(manager.save).toHaveBeenCalledWith(
      JadwalDokter,
      expect.arrayContaining([
        expect.objectContaining({ hari: HariPraktik.SENIN, hariUrutan: 1 }),
        expect.objectContaining({ hari: HariPraktik.RABU, hariUrutan: 3 }),
        expect.objectContaining({ hari: HariPraktik.JUMAT, hariUrutan: 5 }),
      ]),
    );
    expect(result).toHaveLength(3);
    expect(result[1].hariLabel).toBe('Rabu');
  });

  it('mengecualikan ID jadwal sendiri saat update agar tidak bentrok dengan dirinya sendiri', async () => {
    const { service, overlapQb } = createService();

    await service.update(100, {
      jamMulai: '08:30',
      jamSelesai: '12:30',
    });

    expect(overlapQb.andWhere).toHaveBeenCalledWith('jadwal.id != :excludeId', {
      excludeId: 100,
    });
  });

  it('menolak aktivasi ulang status menjadi Y bila jadwal bentrok dengan jadwal aktif lain', async () => {
    const { service, manager, overlapQb } = createService();
    manager.findOne.mockImplementation((entity: unknown) => {
      if (entity === Dokter) {
        return Promise.resolve({
          id: 1,
          status: StatusAktifMaster.AKTIF,
          tenantId,
        });
      }
      if (entity === Unit) {
        return Promise.resolve({
          id: 2,
          status: StatusAktifMaster.AKTIF,
          tenantId,
        });
      }
      return Promise.resolve({
        id: 100,
        dokterId: 1,
        unitId: 2,
        hari: HariPraktik.SENIN,
        jamMulai: '08:00',
        jamSelesai: '12:00',
        status: StatusAktifMaster.NONAKTIF,
        tenantId,
      });
    });
    overlapQb.getMany.mockResolvedValue([
      {
        id: 200,
        hari: HariPraktik.SENIN,
        jamMulai: '10:00',
        jamSelesai: '14:00',
        unitId: 3,
        unit: { id: 3, nama: 'Poli Jantung' },
      },
    ]);

    await expect(
      service.updateStatus(100, { status: StatusAktifMaster.AKTIF }),
    ).rejects.toThrow(ConflictException);
  });

  it('memetakan tanggal YYYY-MM-DD menjadi HariPraktik saat findOptions dan menolak tanggal tidak valid', async () => {
    const { service, readQb } = createService();

    // 2026-11-11 adalah hari Rabu
    await service.findOptions({ tanggal: '2026-11-11', unitId: 2 });
    expect(readQb.andWhere).toHaveBeenCalledWith('jadwalDokter.hari = :hari', {
      hari: HariPraktik.RABU,
    });

    // Tanggal kabisat/kalender tidak valid harus ditolak
    await expect(
      service.findOptions({ tanggal: '2026-02-30' }),
    ).rejects.toThrow(BadRequestException);

    // Tanggal tidak cocok dengan parameter hari
    await expect(
      service.findOptions({ tanggal: '2026-11-11', hari: HariPraktik.SENIN }),
    ).rejects.toThrow(BadRequestException);
  });

  it('mengelompokkan rekap jadwal mingguan untuk 7 hari (Senin - Minggu) dalam 1 query', async () => {
    const { service, readQb } = createService();
    const hasil = await service.getWeeklySchedule({});

    expect(readQb.getMany).toHaveBeenCalledTimes(1);
    expect(hasil).toHaveLength(7);
    expect(hasil[0]).toMatchObject({
      hari: HariPraktik.SENIN,
      label: 'Senin',
      urutan: 1,
      kodeBpjs: 1,
      totalJadwal: 1,
    });
    expect(hasil[6]).toMatchObject({
      hari: HariPraktik.MINGGU,
      label: 'Minggu',
      urutan: 7,
      kodeBpjs: 7,
      totalJadwal: 0,
    });
  });

  it('menolak penghapusan jadwal jika masih direferensikan oleh transaksi (PG 23503)', async () => {
    const { service, repo } = createService();
    repo.remove.mockRejectedValue({ code: '23503' });

    await expect(service.remove(100)).rejects.toThrow(ConflictException);
  });
});
