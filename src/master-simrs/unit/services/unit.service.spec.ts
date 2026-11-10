import { BadRequestException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { Unit } from '@entities/unit.entity';
import { Kelas } from '@entities/kelas.entity';
import { JenisUnit } from '../../constants/simrs.enum';
import { UnitService } from './unit.service';

describe('UnitService', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';

  const createService = () => {
    const detailQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 10,
        kode: 'UNIT-MLT',
        nama: 'Bangsal Melati',
        jenisUnit: JenisUnit.RAWAT_INAP,
        isTersediaBed: true,
      }),
    };

    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((payload: Record<string, unknown>) => ({
        id: 10,
        ...payload,
      })),
      save: jest.fn((entity: Record<string, unknown>) =>
        Promise.resolve({ id: 10, ...entity }),
      ),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(() => detailQb),
    };
    const kelasRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 1, status: 'Y' }),
    };
    const tenantService = { getTenantId: jest.fn(() => tenantId) };

    const service = new UnitService(
      repo as unknown as Repository<Unit>,
      kelasRepo as unknown as Repository<Kelas>,
      tenantService as unknown as TenantContextService,
    );

    return { service, repo, kelasRepo, detailQb };
  };

  it('otomatis menyetel isTersediaBed = true untuk unit RAWAT_INAP bila tidak dikirim', async () => {
    const { service, repo } = createService();

    const created = await service.create({
      kode: 'UNIT-MLT',
      nama: 'Bangsal Melati',
      jenisUnit: JenisUnit.RAWAT_INAP,
      kelasDefaultId: 1,
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        kode: 'UNIT-MLT',
        isTersediaBed: true,
        tenantId,
      }),
    );
    expect(created.id).toBe(10);
  });

  it('menolak jika unit menjadikan dirinya sendiri sebagai parentId', async () => {
    const { service } = createService();

    await expect(
      service.update(10, {
        parentId: 10,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('menolak hierarki parent yang membentuk siklus (circular reference)', async () => {
    const { service, repo } = createService();
    repo.findOne
      .mockResolvedValueOnce(null) // cek kode
      .mockResolvedValueOnce(null) // cek nama
      .mockResolvedValueOnce({ id: 20, status: 'Y', tenantId }) // parentId 20 valid
      .mockResolvedValueOnce({ id: 20, parentId: 10 }); // ancestor dari 20 mengarah ke 10 -> siklus!

    await expect(
      service.update(10, {
        parentId: 20,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('menolak penghapusan jika unit masih memiliki sub-unit atau bed (FK 23503)', async () => {
    const { service, repo } = createService();
    repo.remove.mockRejectedValue({ code: '23503' });

    await expect(service.remove(10)).rejects.toThrow(ConflictException);
    expect(repo.remove).toHaveBeenCalledTimes(1);
  });
});
