import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { Dokter } from '@entities/dokter.entity';
import { Pegawai } from '@entities/pegawai.entity';
import { Penduduk } from '@entities/penduduk.entity';
import { PegawaiService } from '@src/pegawai/pegawai.service';
import { PendudukService } from '../../penduduk/services/penduduk.service';
import { JenisDokter, JenisKelamin } from '../../constants/simrs.enum';
import { DokterService, formatNamaGelarDokter } from './dokter.service';

describe('DokterService', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';

  const createService = () => {
    const manager = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn((_entity: unknown, payload: Record<string, unknown>) => ({
        id: 99,
        ...payload,
      })),
      save: jest.fn((_entity: unknown, entity: Record<string, unknown>) =>
        Promise.resolve({ id: 99, ...entity }),
      ),
    };

    const detailQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 99,
        kodeDokter: 'DOK-001',
        gelarDepan: 'dr.',
        gelarBelakang: 'Sp.PD',
        penduduk: { id: 10, namaLengkap: 'Budi Santoso' },
        pegawai: { id: 20, nip: 'PEG-001' },
      }),
    };

    const repo = {
      createQueryBuilder: jest.fn(() => detailQb),
      findOneBy: jest.fn(),
      softRemove: jest.fn(),
    };
    const pegawaiRepo = { createQueryBuilder: jest.fn() };
    const pendudukRepo = { createQueryBuilder: jest.fn() };
    const dataSource = {
      transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
        cb(manager),
      ),
    };
    const pendudukService = {
      createInTransaction: jest.fn().mockResolvedValue({
        id: 10,
        nik: '3273011505900001',
        namaLengkap: 'Budi Santoso',
      }),
    };
    const pegawaiService = {
      createInTransaction: jest.fn().mockResolvedValue({
        id: 20,
        nip: 'PEG-001',
        name: 'Budi Santoso',
        pendudukId: 10,
      }),
    };
    const tenantService = {
      getTenantId: jest.fn(() => tenantId),
    };

    const service = new DokterService(
      repo as unknown as Repository<Dokter>,
      pegawaiRepo as unknown as Repository<Pegawai>,
      pendudukRepo as unknown as Repository<Penduduk>,
      dataSource as unknown as DataSource,
      pendudukService as unknown as PendudukService,
      pegawaiService as unknown as PegawaiService,
      tenantService as unknown as TenantContextService,
    );

    return {
      service,
      manager,
      pendudukService,
      pegawaiService,
      detailQb,
    };
  };

  it('memformat nama tampilan gelar dokter dengan benar', () => {
    expect(formatNamaGelarDokter('dr.', 'Budi Santoso', 'Sp.PD')).toBe(
      'dr. Budi Santoso, Sp.PD',
    );
    expect(formatNamaGelarDokter(null, 'Siti Aminah', null)).toBe(
      'Siti Aminah',
    );
  });

  it('berhasil melakukan onboarding dokter baru terpadu (penduduk + pegawai + dokter) dalam 1 transaksi', async () => {
    const { service, manager, pendudukService, pegawaiService } =
      createService();
    manager.findOne.mockResolvedValue(null);

    const result = await service.create({
      kodeDokter: 'DOK-001',
      gelarDepan: 'dr.',
      gelarBelakang: 'Sp.PD',
      jenisDokter: JenisDokter.SPESIALIS,
      spesialisasi: 'Penyakit Dalam',
      isStrSeumurHidup: true,
      penduduk: {
        nik: '3273011505900001',
        namaLengkap: 'Budi Santoso',
        jenisKelamin: JenisKelamin.LAKI_LAKI,
      },
      pegawai: {
        nip: 'PEG-001',
      },
    });

    expect(pendudukService.createInTransaction).toHaveBeenCalledTimes(1);
    expect(pegawaiService.createInTransaction).toHaveBeenCalledWith(
      manager,
      tenantId,
      expect.objectContaining({
        nip: 'PEG-001',
        pendudukId: 10,
        name: 'Budi Santoso',
      }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      Dokter,
      expect.objectContaining({
        kodeDokter: 'DOK-001',
        pendudukId: 10,
        pegawaiId: 20,
        strBerlakuSampai: null,
        tenantId,
      }),
    );
    expect(result.namaTampilan).toBe('dr. Budi Santoso, Sp.PD');
  });

  it('menolak jika pegawaiId yang dipilih sudah terikat ke penduduk yang berbeda', async () => {
    const { service, manager } = createService();

    manager.findOne.mockImplementation((entity: unknown) => {
      if (entity === Penduduk) {
        return Promise.resolve({
          id: 10,
          namaLengkap: 'Budi Santoso',
          tenantId,
        });
      }
      if (entity === Pegawai) {
        return Promise.resolve({
          id: 20,
          nip: 'PEG-999',
          pendudukId: 999,
          tenantId,
        });
      }
      return Promise.resolve(null);
    });

    await expect(
      service.create({
        kodeDokter: 'DOK-002',
        pendudukId: 10,
        pegawaiId: 20,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('menolak jika tanggal berakhir STR lebih awal dari tanggal terbit STR', async () => {
    const { service, manager } = createService();

    manager.findOne.mockImplementation((entity: unknown) => {
      if (entity === Penduduk) {
        return Promise.resolve({
          id: 10,
          namaLengkap: 'Budi Santoso',
          tenantId,
        });
      }
      return Promise.resolve(null);
    });

    await expect(
      service.create({
        kodeDokter: 'DOK-003',
        pendudukId: 10,
        isStrSeumurHidup: false,
        strTerbitPada: '2025-05-10',
        strBerlakuSampai: '2024-01-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('menolak jika penduduk sudah terdaftar sebagai dokter lain', async () => {
    const { service, manager } = createService();

    manager.findOne.mockImplementation(
      (entity: unknown, opts?: { where?: { pendudukId?: number } }) => {
        if (entity === Penduduk) {
          return Promise.resolve({
            id: 10,
            namaLengkap: 'Budi Santoso',
            tenantId,
          });
        }
        if (entity === Dokter && opts?.where?.pendudukId === 10) {
          return Promise.resolve({ id: 50, kodeDokter: 'DOK-EXISTING' });
        }
        return Promise.resolve(null);
      },
    );

    await expect(
      service.create({
        kodeDokter: 'DOK-004',
        pendudukId: 10,
      }),
    ).rejects.toThrow(ConflictException);
  });
});
