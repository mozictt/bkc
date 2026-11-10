import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { Pasien } from '@entities/pasien.entity';
import { PasienPenjamin } from '@entities/pasien-penjamin.entity';
import { Penjamin } from '@entities/penjamin.entity';
import { Penduduk } from '@entities/penduduk.entity';
import { PendudukService } from '../../penduduk/services/penduduk.service';
import {
  FormatNoRm,
  JenisKelamin,
  JenisPenjamin,
} from '../../constants/simrs.enum';
import { PasienService, formatNoRmSequence } from './pasien.service';

describe('PasienService', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';

  const createService = () => {
    const manager = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      query: jest.fn().mockResolvedValue([{ last_value: '1' }]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn((_entity: unknown, payload: Record<string, unknown>) => ({
        id: 100,
        ...payload,
      })),
      save: jest.fn((_entity: unknown, data: unknown) => {
        if (Array.isArray(data)) {
          return Promise.resolve(
            data.map((item, idx) => ({
              id: 200 + idx,
              ...(item as Record<string, unknown>),
            })),
          );
        }
        return Promise.resolve({
          id: 100,
          ...(data as Record<string, unknown>),
        });
      }),
    };

    const detailQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue({
        id: 100,
        noRm: '00000001',
        pendudukId: 10,
        penduduk: { id: 10, namaLengkap: 'Siti Aminah' },
        penjaminList: [
          {
            id: 200,
            penjaminId: 1,
            penjamin: {
              id: 1,
              kode: 'BPJS',
              nama: 'BPJS Kesehatan',
              jenisPenjamin: JenisPenjamin.BPJS,
            },
            isUtama: true,
          },
        ],
      }),
    };

    const repo = {
      createQueryBuilder: jest.fn(() => detailQb),
      findOneBy: jest.fn().mockResolvedValue({
        id: 100,
        noRm: '00000001',
        tenantId,
      }),
      softRemove: jest.fn(),
    };
    const penjaminRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({
        id: 200,
        penjaminId: 2,
        penjamin: { id: 2, kode: 'PRU', nama: 'Prudential' },
      }),
      softRemove: jest.fn(),
    };
    const dataSource = {
      transaction: jest.fn((cb: (m: typeof manager) => Promise<unknown>) =>
        cb(manager),
      ),
    };
    const pendudukService = {
      createInTransaction: jest.fn().mockResolvedValue({
        id: 10,
        nik: null,
        namaLengkap: 'By. Ny. Siti Aminah',
      }),
    };
    const tenantService = {
      getTenantId: jest.fn(() => tenantId),
    };

    const service = new PasienService(
      repo as unknown as Repository<Pasien>,
      penjaminRepo as unknown as Repository<PasienPenjamin>,
      dataSource as unknown as DataSource,
      pendudukService as unknown as PendudukService,
      tenantService as unknown as TenantContextService,
    );

    return {
      service,
      manager,
      repo,
      penjaminRepo,
      pendudukService,
    };
  };

  it('memformat nomor rekam medis PLAIN_8 (00000001) dan DASH_6 (00-00-01) dengan benar', () => {
    expect(formatNoRmSequence(1, FormatNoRm.PLAIN_8)).toBe('00000001');
    expect(formatNoRmSequence(125, FormatNoRm.PLAIN_8)).toBe('00000125');
    expect(formatNoRmSequence(1, FormatNoRm.DASH_6)).toBe('00-00-01');
    expect(formatNoRmSequence(1234, FormatNoRm.DASH_6)).toBe('00-12-34');
    expect(formatNoRmSequence(123456, FormatNoRm.DASH_6)).toBe('12-34-56');
  });

  it('berhasil mendaftarkan pasien bayi baru lahir tanpa NIK dengan auto-generate No. RM & multi penjamin FK master dalam 1 transaksi', async () => {
    const { service, manager, pendudukService } = createService();

    manager.findOne.mockImplementation((entity: unknown) => {
      if (entity === Penduduk) {
        return Promise.resolve({ id: 5 });
      }
      return Promise.resolve(null);
    });
    manager.find.mockImplementation((entity: unknown) => {
      if (entity === Penjamin) {
        return Promise.resolve([
          {
            id: 1,
            kode: 'BPJS',
            nama: 'BPJS Kesehatan',
            butuhNoKartu: true,
            status: 'Y',
          },
          {
            id: 2,
            kode: 'PRU',
            nama: 'Prudential',
            butuhNoKartu: true,
            status: 'Y',
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const result = await service.create({
      formatNoRm: FormatNoRm.DASH_6,
      isBayiBaruLahir: true,
      pendudukIbuId: 5,
      penduduk: {
        namaLengkap: 'By. Ny. Siti Aminah',
        jenisKelamin: JenisKelamin.PEREMPUAN,
      },
      penjaminList: [
        {
          penjaminId: 1,
          noKartu: '0001234567890',
        },
        {
          penjaminId: 2,
          noKartu: 'PRU-9988',
        },
      ],
    });

    expect(pendudukService.createInTransaction).toHaveBeenCalledTimes(1);
    expect(manager.find).toHaveBeenCalledTimes(1); // Batch lookup penjamin anti-N+1
    expect(manager.save).toHaveBeenCalledWith(
      Pasien,
      expect.objectContaining({
        noRm: '00-00-01',
        pendudukId: 10,
        pendudukIbuId: 5,
        isBayiBaruLahir: true,
        tenantId,
      }),
    );
    expect(manager.save).toHaveBeenCalledWith(
      PasienPenjamin,
      expect.arrayContaining([
        expect.objectContaining({
          penjaminId: 1,
          isUtama: true,
          pasienId: 100,
        }),
        expect.objectContaining({
          penjaminId: 2,
          isUtama: false,
          pasienId: 100,
        }),
      ]),
    );
    expect(result.penjaminUtama?.penjaminId).toBe(1);
  });

  it('menolak jika penjamin wajib nomor kartu (butuhNoKartu = true) namun noKartu kosong', async () => {
    const { service, manager } = createService();
    manager.findOne.mockImplementation((entity: unknown) => {
      if (entity === Penduduk) {
        return Promise.resolve({ id: 10, namaLengkap: 'Budi' });
      }
      return Promise.resolve(null);
    });
    manager.find.mockResolvedValue([
      {
        id: 1,
        kode: 'BPJS',
        nama: 'BPJS Kesehatan',
        butuhNoKartu: true,
        status: 'Y',
      },
    ]);

    await expect(
      service.create({
        pendudukId: 10,
        penjaminList: [{ penjaminId: 1 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('menolak jika terdapat lebih dari 1 penjamin utama pada payload pendaftaran pasien', async () => {
    const { service, manager } = createService();
    manager.findOne.mockImplementation((entity: unknown) => {
      if (entity === Penduduk) {
        return Promise.resolve({ id: 10, namaLengkap: 'Budi' });
      }
      return Promise.resolve(null);
    });
    manager.find.mockResolvedValue([
      { id: 1, nama: 'BPJS', butuhNoKartu: true, status: 'Y' },
      { id: 3, nama: 'Umum', butuhNoKartu: false, status: 'Y' },
    ]);

    await expect(
      service.create({
        pendudukId: 10,
        penjaminList: [
          { penjaminId: 1, noKartu: '0001', isUtama: true },
          { penjaminId: 3, isUtama: true },
        ],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('menolak jika penduduk sudah terdaftar sebagai pasien pada tenant yang sama', async () => {
    const { service, manager } = createService();
    manager.findOne.mockImplementation((entity: unknown) => {
      if (entity === Penduduk) {
        return Promise.resolve({ id: 10, namaLengkap: 'Budi' });
      }
      if (entity === Pasien) {
        return Promise.resolve({ id: 55, noRm: '00000055' });
      }
      return Promise.resolve(null);
    });

    await expect(
      service.create({
        pendudukId: 10,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('mereset penjamin utama lama ketika menambah penjamin baru dengan isUtama = true', async () => {
    const { service, manager } = createService();
    manager.findOne.mockResolvedValue(null);
    manager.find.mockResolvedValue([
      {
        id: 2,
        kode: 'ALZ',
        nama: 'Allianz',
        butuhNoKartu: true,
        status: 'Y',
      },
    ]);

    const added = await service.addPenjamin(100, {
      penjaminId: 2,
      noKartu: 'ALZ-001',
      isUtama: true,
    });

    expect(manager.update).toHaveBeenCalledWith(
      PasienPenjamin,
      { pasienId: 100, tenantId, isUtama: true },
      { isUtama: false },
    );
    expect(added?.penjaminId).toBe(2);
  });
});
