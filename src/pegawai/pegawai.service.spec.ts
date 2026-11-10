import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TenantContextService } from '@src/common/tenant/tenant-context.service';
import { Dokter } from '@entities/dokter.entity';
import { Pegawai } from '@entities/pegawai.entity';
import { Penduduk } from '@entities/penduduk.entity';
import { User } from '@entities/user.entity';
import { PegawaiService } from '@src/pegawai/pegawai.service';

describe('PegawaiService (Integrasi Penduduk & Dokter)', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';

  const createService = (
    managerOverrides: Partial<
      Record<'findOne' | 'create' | 'save', jest.Mock>
    > = {},
  ) => {
    const manager = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_entity: unknown, payload: Record<string, unknown>) => ({
        id: 20,
        ...payload,
      })),
      save: jest.fn((_entity: unknown, entity: Record<string, unknown>) =>
        Promise.resolve({ id: 20, ...entity }),
      ),
      ...managerOverrides,
    };

    const pegawaiRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 20,
        nip: 'PEG-001',
        name: 'Budi Santoso',
        tenantId,
      }),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const userRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const dokterRepo = { findOne: jest.fn().mockResolvedValue(null) };
    const dataSource = { manager };
    const tenantContext = { getTenantId: jest.fn(() => tenantId) };

    const service = new PegawaiService(
      pegawaiRepo as unknown as Repository<Pegawai>,
      userRepo as unknown as Repository<User>,
      dokterRepo as unknown as Repository<Dokter>,
      dataSource as unknown as DataSource,
      tenantContext as unknown as TenantContextService,
    );

    return { service, manager, pegawaiRepo, userRepo, dokterRepo };
  };

  it('menolak pembuatan pegawai jika tanggalKeluar lebih awal dari tanggalMasuk', async () => {
    const { service } = createService();

    await expect(
      service.create({
        nip: 'PEG-002',
        name: 'Budi',
        tanggalMasuk: '2026-05-01',
        tanggalKeluar: '2026-01-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('menolak jika pendudukId yang dipilih tidak ditemukan pada tenant aktif', async () => {
    const { service, manager } = createService();
    manager.findOne.mockImplementation(() => Promise.resolve(null));

    await expect(
      service.create({
        nip: 'PEG-003',
        name: 'Budi',
        pendudukId: 999,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('menolak penghapusan pegawai jika masih terhubung ke data dokter', async () => {
    const { service, dokterRepo } = createService();
    dokterRepo.findOne.mockResolvedValue({ id: 77 });

    await expect(service.remove(20)).rejects.toThrow(ConflictException);
  });

  it('berhasil menautkan pegawai baru ke penduduk dalam transaksi dan mewarisi data kontak jika kosong', async () => {
    const { service, manager } = createService();
    manager.findOne.mockImplementation((entity: unknown) => {
      if (entity === Penduduk) {
        return Promise.resolve({
          id: 10,
          namaLengkap: 'Budi Santoso',
          email: 'budi@rs.id',
          noTelepon: '08123456789',
          alamatKtp: 'Jl. Sehat No. 1',
          idKelurahan: '32.73.08.1001',
        });
      }
      return Promise.resolve(null);
    });

    const saved = await service.createInTransaction(
      manager as unknown as EntityManager,
      tenantId,
      {
        pendudukId: 10,
        nip: 'PEG-010',
        name: 'Budi Santoso',
      },
    );

    expect(manager.save).toHaveBeenCalledWith(
      Pegawai,
      expect.objectContaining({
        pendudukId: 10,
        nip: 'PEG-010',
        email: 'budi@rs.id',
        phoneNumber: '08123456789',
        address: 'Jl. Sehat No. 1',
        idKelurahan: '32.73.08.1001',
        tenantId,
      }),
    );
    expect(saved.id).toBe(20);
  });
});
