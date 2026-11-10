import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { Penjamin } from '@entities/penjamin.entity';
import { JenisPenjamin } from '../../constants/simrs.enum';
import { PenjaminService } from './penjamin.service';

describe('PenjaminService', () => {
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
      softRemove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };
    const tenantService = { getTenantId: jest.fn(() => tenantId) };

    const service = new PenjaminService(
      repo as unknown as Repository<Penjamin>,
      tenantService as unknown as TenantContextService,
    );

    return { service, repo };
  };

  it('berhasil membuat master penjamin baru dalam tenant aktif', async () => {
    const { service, repo } = createService();

    const created = await service.create({
      kode: 'BPJS',
      nama: 'BPJS Kesehatan',
      jenisPenjamin: JenisPenjamin.BPJS,
      butuhNoKartu: true,
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        kode: 'BPJS',
        nama: 'BPJS Kesehatan',
        tenantId,
      }),
    );
    expect(created.id).toBe(1);
  });

  it('menolak jika kode penjamin sudah digunakan pada tenant yang sama', async () => {
    const { service, repo } = createService();
    repo.findOne.mockResolvedValueOnce({ id: 9 }).mockResolvedValueOnce(null);

    await expect(
      service.create({
        kode: 'BPJS',
        nama: 'BPJS Kesehatan Duplikat',
        jenisPenjamin: JenisPenjamin.BPJS,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('melempar NotFoundException jika penjamin tidak ditemukan', async () => {
    const { service, repo } = createService();
    repo.findOne.mockResolvedValue(null);

    await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
  });

  it('menolak penghapusan jika penjamin masih digunakan oleh data pasien_penjamin (FK 23503)', async () => {
    const { service, repo } = createService();
    repo.findOne.mockResolvedValue({
      id: 1,
      kode: 'BPJS',
      nama: 'BPJS Kesehatan',
      tenantId,
    });
    repo.softRemove.mockRejectedValue({ code: '23503' });

    await expect(service.remove(1)).rejects.toThrow(ConflictException);
  });
});
