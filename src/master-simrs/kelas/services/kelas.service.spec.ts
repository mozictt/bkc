import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { Kelas } from '@entities/kelas.entity';
import { KelasService } from './kelas.service';

describe('KelasService', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';

  const createService = () => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((payload: Record<string, unknown>) => ({
        id: 1,
        ...payload,
      })),
      save: jest.fn((entity: Record<string, unknown>) =>
        Promise.resolve({ id: 1, ...entity }),
      ),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const tenantService = { getTenantId: jest.fn(() => tenantId) };

    const service = new KelasService(
      repo as unknown as Repository<Kelas>,
      tenantService as unknown as TenantContextService,
    );

    return { service, repo };
  };

  it('berhasil membuat master kelas baru dan memformat tarifAkomodasi', async () => {
    const { service, repo } = createService();

    const created = await service.create({
      kode: 'KL1',
      nama: 'Kelas 1',
      urutan: 3,
      kodeBpjsAplicare: 'KL1',
      tarifAkomodasi: 350000,
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        kode: 'KL1',
        nama: 'Kelas 1',
        tarifAkomodasi: '350000.00',
        tenantId,
      }),
    );
    expect(created.id).toBe(1);
  });

  it('menolak jika kode kelas sudah digunakan pada tenant yang sama', async () => {
    const { service, repo } = createService();
    repo.findOne.mockResolvedValueOnce({ id: 2 }).mockResolvedValueOnce(null);

    await expect(
      service.create({
        kode: 'KL1',
        nama: 'Kelas 1 Lain',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('melempar NotFoundException jika kelas tidak ditemukan', async () => {
    const { service, repo } = createService();
    repo.findOne.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('menolak penghapusan jika kelas masih dipakai oleh unit atau bed (FK 23503)', async () => {
    const { service, repo } = createService();
    repo.findOne.mockResolvedValue({ id: 1, nama: 'Kelas 1', tenantId });
    repo.remove.mockRejectedValue({ code: '23503' });

    await expect(service.remove(1)).rejects.toThrow(ConflictException);
    expect(repo.remove).toHaveBeenCalledTimes(1);
  });
});
