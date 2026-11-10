import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { Penduduk } from '@entities/penduduk.entity';
import { JenisKelamin } from '../../constants/simrs.enum';
import { PendudukService } from './penduduk.service';

describe('PendudukService', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';

  const createService = (
    managerOverrides: Partial<
      Record<'findOne' | 'create' | 'save', jest.Mock>
    > = {},
  ) => {
    const manager = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((_entity: unknown, payload: Record<string, unknown>) => ({
        id: 10,
        ...payload,
      })),
      save: jest.fn((_entity: unknown, entity: Record<string, unknown>) =>
        Promise.resolve({ id: 10, ...entity }),
      ),
      ...managerOverrides,
    };

    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 10,
        nik: '3273011505900001',
        namaLengkap: 'Dr. Budi',
        tenantId,
      }),
    };

    const repo = {
      createQueryBuilder: jest.fn(() => qb),
      findOneBy: jest.fn(),
      remove: jest.fn(),
    };

    const dataSource = { manager };
    const tenantService = {
      getTenantId: jest.fn(() => tenantId),
    };

    const service = new PendudukService(
      repo as unknown as Repository<Penduduk>,
      dataSource as unknown as DataSource,
      tenantService as unknown as TenantContextService,
    );
    return { service, manager, repo, qb };
  };

  it('berhasil membuat penduduk baru dalam tenant aktif', async () => {
    const { service, manager } = createService({
      findOne: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: '32.73.08.1001' }),
    });

    const result = await service.create({
      nik: '3273011505900001',
      namaLengkap: 'Budi Santoso',
      jenisKelamin: JenisKelamin.LAKI_LAKI,
      tanggalLahir: '1990-05-15',
      idKelurahan: '32.73.08.1001',
    });

    expect(manager.save).toHaveBeenCalledWith(
      Penduduk,
      expect.objectContaining({
        nik: '3273011505900001',
        namaLengkap: 'Budi Santoso',
        tenantId,
      }),
    );
    expect(result.id).toBe(10);
  });

  it('menolak jika NIK sudah terdaftar pada tenant yang sama', async () => {
    const { service } = createService({
      findOne: jest.fn().mockResolvedValueOnce({
        id: 5,
        nik: '3273011505900001',
      }),
    });

    await expect(
      service.create({
        nik: '3273011505900001',
        namaLengkap: 'Budi Duplikat',
        jenisKelamin: JenisKelamin.LAKI_LAKI,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('menolak tanggal lahir di masa depan', async () => {
    const { service } = createService();

    await expect(
      service.create({
        nik: '3273011505900001',
        namaLengkap: 'Budi Masa Depan',
        jenisKelamin: JenisKelamin.LAKI_LAKI,
        tanggalLahir: '2099-01-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('menolak penghapusan jika penduduk masih direferensikan (FK 23503)', async () => {
    const { service, repo } = createService();
    repo.findOneBy.mockResolvedValue({
      id: 10,
      namaLengkap: 'Budi Santoso',
      tenantId,
    });
    repo.remove.mockRejectedValue({ code: '23503' });

    await expect(service.remove(10)).rejects.toThrow(ConflictException);
    expect(repo.remove).toHaveBeenCalledTimes(1);
  });

  it('dapat dipanggil dalam transaksi luar melalui createInTransaction', async () => {
    const { service, manager } = createService();
    const saved = await service.createInTransaction(
      manager as unknown as EntityManager,
      tenantId,
      {
        nik: '3273011505900009',
        namaLengkap: 'Ani Wijaya',
        jenisKelamin: JenisKelamin.PEREMPUAN,
      },
    );
    expect(saved.id).toBe(10);
  });
});
