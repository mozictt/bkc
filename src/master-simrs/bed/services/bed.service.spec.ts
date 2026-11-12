import { BadRequestException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { Bed } from '@entities/bed.entity';
import { Unit } from '@entities/unit.entity';
import { Kelas } from '@entities/kelas.entity';
import { Pendaftaran } from '@entities/pendaftaran.entity';
import { StatusKetersediaanBed } from '../../constants/simrs.enum';
import { BedService } from './bed.service';

describe('BedService', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';

  const createService = () => {
    const detailQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 50,
        kode: 'MLT-101-01',
        nama: 'Bed 01',
        unitId: 10,
        kelasId: 1,
        statusKetersediaan: StatusKetersediaanBed.KOSONG,
      }),
    };

    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((payload: Record<string, unknown>) => ({
        id: 50,
        ...payload,
      })),
      save: jest.fn((entity: Record<string, unknown>) =>
        Promise.resolve({ id: 50, ...entity }),
      ),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(() => detailQb),
    };
    const unitRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 10,
        nama: 'Bangsal Melati',
        isTersediaBed: true,
        status: 'Y',
        tenantId,
      }),
    };
    const kelasRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        nama: 'Kelas 1',
        status: 'Y',
        tenantId,
      }),
    };
    const tenantService = { getTenantId: jest.fn(() => tenantId) };

    const service = new BedService(
      repo as unknown as Repository<Bed>,
      unitRepo as unknown as Repository<Unit>,
      kelasRepo as unknown as Repository<Kelas>,
      tenantService as unknown as TenantContextService,
    );

    return { service, repo, unitRepo, kelasRepo, detailQb };
  };

  it('berhasil membuat master bed baru dengan relasi unit dan kelas aktif', async () => {
    const { service, repo } = createService();

    const created = await service.create({
      kode: 'MLT-101-01',
      nama: 'Bed 01',
      namaKamar: 'Kamar 101',
      unitId: 10,
      kelasId: 1,
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        kode: 'MLT-101-01',
        unitId: 10,
        kelasId: 1,
        tenantId,
      }),
    );
    expect(created.id).toBe(50);
  });

  it('menolak pembuatan bed jika unit tidak mendukung tempat tidur (isTersediaBed = false)', async () => {
    const { service, unitRepo } = createService();
    unitRepo.findOne.mockResolvedValue({
      id: 99,
      nama: 'Instalasi Farmasi',
      isTersediaBed: false,
      status: 'Y',
      tenantId,
    });

    await expect(
      service.create({
        kode: 'FRM-01',
        nama: 'Bed 01',
        unitId: 99,
        kelasId: 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('menolak jika nama bed duplikat di unit dan kamar yang sama', async () => {
    const { service, repo } = createService();
    repo.findOne
      .mockResolvedValueOnce(null) // kode unik
      .mockResolvedValueOnce({ id: 51 }); // dup nama bed di kamar yang sama

    await expect(
      service.create({
        kode: 'MLT-101-02',
        nama: 'Bed 01',
        namaKamar: 'Kamar 101',
        unitId: 10,
        kelasId: 1,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('menolak penghapusan bed jika status ketersediaan sedang TERISI', async () => {
    const { service, detailQb } = createService();
    detailQb.getOne.mockResolvedValue({
      id: 50,
      kode: 'MLT-101-01',
      nama: 'Bed 01',
      statusKetersediaan: StatusKetersediaanBed.TERISI,
    });

    await expect(service.remove(50)).rejects.toThrow(ConflictException);
  });

  it('memperbarui status ketersediaan bed melalui updateStatusKetersediaan', async () => {
    const { service, repo } = createService();

    await service.updateStatusKetersediaan(50, {
      statusKetersediaan: StatusKetersediaanBed.PEMBERSIHAN,
      keterangan: 'Sterilisasi kamar',
    });

    expect(repo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 50,
        statusKetersediaan: StatusKetersediaanBed.PEMBERSIHAN,
        keterangan: 'Sterilisasi kamar',
      }),
    );
  });

  it('menolak pengubahan status bed TERISI secara manual jika masih ditempati kunjungan aktif', async () => {
    const { repo, unitRepo, kelasRepo, detailQb } = createService();
    detailQb.getOne.mockResolvedValue({
      id: 50,
      kode: 'MLT-101-01',
      nama: 'Bed 01',
      unitId: 10,
      kelasId: 1,
      statusKetersediaan: StatusKetersediaanBed.TERISI,
    });
    const pendaftaranRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 901,
        noRegistrasi: 'REG-20261111-0001',
      }),
    };
    const tenantService = { getTenantId: jest.fn(() => tenantId) };

    const guardedService = new BedService(
      repo as unknown as Repository<Bed>,
      unitRepo as unknown as Repository<Unit>,
      kelasRepo as unknown as Repository<Kelas>,
      tenantService as unknown as TenantContextService,
      pendaftaranRepo as unknown as Repository<Pendaftaran>,
    );

    await expect(
      guardedService.updateStatusKetersediaan(50, {
        statusKetersediaan: StatusKetersediaanBed.KOSONG,
      }),
    ).rejects.toThrow(ConflictException);
  });
});
