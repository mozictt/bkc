import { BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { TarifTindakan } from '@entities/tarif-tindakan.entity';
import { TarifLayanan } from '@entities/tarif-layanan.entity';
import { Unit } from '@entities/unit.entity';
import { Penjamin } from '@entities/penjamin.entity';
import { Kelas } from '@entities/kelas.entity';
import { JenisTarif, StatusAktifMaster } from '../../constants/simrs.enum';
import { TarifService } from './tarif.service';
import {
  calculateTarifNominal,
  resolveBestTarifRule,
} from '../helpers/tarif.helper';

describe('TarifService & Helper Resolusi Tarif', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';

  const makeRule = (
    id: number,
    unitId: number | null,
    penjaminId: number | null,
    kelasId: number | null,
    totalTarif: string,
    jasaDokter = '50000.00',
    jasaNakes = '15000.00',
  ): TarifLayanan =>
    ({
      id,
      tenantId,
      tindakanId: 1,
      unitId,
      penjaminId,
      kelasId,
      jasaSarana: '35000.00',
      bhp: '0.00',
      jasaDokter,
      jasaNakes,
      totalTarif,
      berlakuMulai: '2026-01-01',
      berlakuSampai: null,
      keterangan: null,
      status: 'Y',
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as TarifLayanan;

  it('menghitung totalTarif secara akurat dan menolak nilai negatif', () => {
    const res = calculateTarifNominal({
      jasaSarana: 45000.5,
      bhp: 12500.25,
      jasaDokter: 80000,
      jasaNakes: 15000,
    });
    expect(res.totalTarif).toBe('152500.75');
    expect(res.numbers.totalTarif).toBe(152500.75);

    expect(() =>
      calculateTarifNominal({ jasaSarana: -100, jasaDokter: 0 }),
    ).toThrow(BadRequestException);
  });

  it('mengutamakan prioritas Unit -> Penjamin -> Kelas secara ketat saat resolusi tarif', () => {
    const globalRule = makeRule(1, null, null, null, '100000.00');
    const kelasOnlyRule = makeRule(2, null, null, 3, '120000.00');
    const penjaminOnlyRule = makeRule(3, null, 2, null, '95000.00');
    const penjaminKelasRule = makeRule(4, null, 2, 3, '115000.00');
    const unitOnlyRule = makeRule(5, 10, null, null, '150000.00');
    const unitPenjaminRule = makeRule(6, 10, 2, null, '140000.00');
    const exactAllRule = makeRule(7, 10, 2, 3, '175000.00');

    // Exact match menang (skor 7)
    const r7 = resolveBestTarifRule(
      [globalRule, penjaminKelasRule, unitOnlyRule, exactAllRule],
      { unitId: 10, penjaminId: 2, kelasId: 3 },
    );
    expect(r7.found).toBe(true);
    expect(r7.rule?.id).toBe(7);
    expect(r7.skorKecocokan).toBe(7);

    // Unit (skor 4) mengalahkan Penjamin + Kelas (skor 3) sesuai prioritas Unit -> Penjamin -> Kelas
    const r4vs3 = resolveBestTarifRule(
      [globalRule, penjaminKelasRule, unitOnlyRule],
      { unitId: 10, penjaminId: 2, kelasId: 3 },
    );
    expect(r4vs3.rule?.id).toBe(5);
    expect(r4vs3.skorKecocokan).toBe(4);

    // Penjamin (skor 2) mengalahkan Kelas (skor 1)
    const r2vs1 = resolveBestTarifRule(
      [globalRule, kelasOnlyRule, penjaminOnlyRule],
      { unitId: 99, penjaminId: 2, kelasId: 3 },
    );
    expect(r2vs1.rule?.id).toBe(3);
    expect(r2vs1.skorKecocokan).toBe(2);

    // Unit + Penjamin (skor 6) menang atas Unit + Kelas (skor 5)
    const r6 = resolveBestTarifRule(
      [globalRule, unitOnlyRule, unitPenjaminRule],
      { unitId: 10, penjaminId: 2, kelasId: 3 },
    );
    expect(r6.rule?.id).toBe(6);
    expect(r6.skorKecocokan).toBe(6);

    // Fallback global (skor 0) saat tidak ada rule spesifik yang cocok
    const r0 = resolveBestTarifRule(
      [globalRule, unitOnlyRule, penjaminOnlyRule],
      { unitId: 88, penjaminId: 77, kelasId: 66 },
    );
    expect(r0.rule?.id).toBe(1);
    expect(r0.skorKecocokan).toBe(0);
  });

  const createServiceWithMocks = () => {
    const savedTindakan: Array<Partial<TarifTindakan>> = [];
    const savedHarga: Array<Partial<TarifLayanan>> = [];

    const repo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((e: Partial<TarifTindakan>) => Promise.resolve({ id: 1, ...e })),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const hargaGetMany = jest.fn().mockResolvedValue([]);
    const hargaGetOne = jest.fn().mockResolvedValue(null);
    const hargaQb = {
      leftJoin: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: hargaGetMany,
      getOne: hargaGetOne,
    };

    const hargaRepo = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      save: jest.fn((e: Partial<TarifLayanan>) => Promise.resolve({ id: 10, ...e })),
      remove: jest.fn(),
      createQueryBuilder: jest.fn(() => hargaQb),
    };

    const unitRepo = {
      findOne: jest.fn(({ where }: { where: Array<{ id: number }> | { id: number } }) => {
        const id = Array.isArray(where) ? where[0].id : where.id;
        return Promise.resolve({
          id,
          kode: `U${id}`,
          nama: `Unit ${id}`,
          jenisUnit: 'RAWAT_JALAN',
          status: 'Y',
          tenantId,
        });
      }),
    };
    const penjaminRepo = {
      findOne: jest.fn(({ where }: { where: Array<{ id: number }> | { id: number } }) => {
        const id = Array.isArray(where) ? where[0].id : where.id;
        return Promise.resolve({
          id,
          kode: `P${id}`,
          nama: `Penjamin ${id}`,
          jenisPenjamin: 'UMUM',
          status: 'Y',
          tenantId,
        });
      }),
    };
    const kelasRepo = {
      findOne: jest.fn(({ where }: { where: Array<{ id: number }> | { id: number } }) => {
        const id = Array.isArray(where) ? where[0].id : where.id;
        return Promise.resolve({
          id,
          kode: `K${id}`,
          nama: `Kelas ${id}`,
          urutan: id,
          status: 'Y',
          tenantId,
        });
      }),
    };

    const txManager = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        tenantId,
        kode: 'LAB-DL',
        nama: 'Darah Lengkap',
        jenisTarif: JenisTarif.LABORATORIUM,
        status: 'Y',
      }),
      getRepository: jest.fn((entity: unknown) => {
        if (entity === TarifTindakan) {
          return {
            create: jest.fn((data: Record<string, unknown>) => ({ ...data })),
            save: jest.fn((data: Record<string, unknown>) => {
              const created = { id: 1, ...data };
              savedTindakan.push(created);
              return Promise.resolve(created);
            }),
          };
        }
        return {
          find: jest.fn(() => Promise.resolve([...savedHarga])),
          create: jest.fn((data: Partial<TarifLayanan>) => ({ ...data })),
          save: jest.fn((data: Partial<TarifLayanan>) => {
            const idx = savedHarga.findIndex(
              (item) => data.id && item.id === data.id,
            );
            if (idx >= 0) {
              savedHarga[idx] = { ...savedHarga[idx], ...data };
              return Promise.resolve(savedHarga[idx]);
            }
            const created = { id: 100 + savedHarga.length, ...data };
            savedHarga.push(created);
            return Promise.resolve(created);
          }),
        };
      }),
    };

    const dataSource = {
      transaction: jest.fn((cb: (m: typeof txManager) => Promise<unknown>) =>
        cb(txManager),
      ),
    };
    const tenantService = { getTenantId: jest.fn(() => tenantId) };

    const service = new TarifService(
      repo as unknown as Repository<TarifTindakan>,
      hargaRepo as unknown as Repository<TarifLayanan>,
      unitRepo as unknown as Repository<Unit>,
      penjaminRepo as unknown as Repository<Penjamin>,
      kelasRepo as unknown as Repository<Kelas>,
      dataSource as unknown as DataSource,
      tenantService as unknown as TenantContextService,
    );

    return {
      service,
      repo,
      hargaRepo,
      hargaGetMany,
      savedTindakan,
      savedHarga,
      txManager,
    };
  };

  it('berhasil membuat master tarif tindakan beserta tarifDefault dan menghitung total otomatis', async () => {
    const { service, repo, hargaGetMany, savedTindakan, savedHarga } =
      createServiceWithMocks();

    repo.findOne
      .mockResolvedValueOnce(null) // unique kode
      .mockResolvedValueOnce(null) // unique nama+jenis
      .mockResolvedValueOnce({
        id: 1,
        tenantId,
        kode: 'LAB-001',
        nama: 'Darah Lengkap',
        jenisTarif: JenisTarif.LABORATORIUM,
        satuan: 'Pemeriksaan',
        status: 'Y',
      });

    hargaGetMany.mockResolvedValueOnce([
      makeRule(100, null, null, null, '135000.00', '30000.00', '20000.00'),
    ]);

    const result = await service.create({
      kode: 'LAB-001',
      nama: 'Darah Lengkap',
      jenisTarif: JenisTarif.LABORATORIUM,
      satuan: 'Pemeriksaan',
      atributKhusus: { spesimen: 'Darah EDTA', butuhPuasa: false, estimasiHasilJam: 2 },
      tarifDefault: {
        jasaSarana: 70000,
        bhp: 15000,
        jasaDokter: 30000,
        jasaNakes: 20000,
      },
    });

    expect(savedTindakan).toHaveLength(1);
    expect(savedHarga).toHaveLength(1);
    expect(savedHarga[0].totalTarif).toBe('135000.00');
    expect(savedHarga[0].jasaDokter).toBe('30000.00');
    expect(savedHarga[0].jasaNakes).toBe('20000.00');
    expect(result.daftarHarga).toHaveLength(1);
  });

  it('menolak duplikat aturan tarif aktif yang tumpang tindih pada kombinasi Unit/Penjamin/Kelas sama', async () => {
    const { service, savedHarga } = createServiceWithMocks();
    savedHarga.push(makeRule(100, 10, null, 1, '120000.00'));

    await expect(
      service.createHarga(1, {
        unitId: 10,
        penjaminId: null,
        kelasId: 1,
        jasaSarana: 50000,
        bhp: 10000,
        jasaDokter: 40000,
        jasaNakes: 20000,
        berlakuMulai: '2026-06-01',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('mendukung bulk generate kombinasi Unit x Penjamin x Kelas dengan mode SKIP dan OVERWRITE', async () => {
    const { service, repo, hargaGetMany, savedHarga } = createServiceWithMocks();
    repo.findOne.mockResolvedValue({
      id: 1,
      tenantId,
      kode: 'RAD-001',
      nama: 'Foto Thorax PA',
      jenisTarif: JenisTarif.RADIOLOGI,
      satuan: 'Pemeriksaan',
      status: 'Y',
    });
    hargaGetMany.mockResolvedValue([]);

    // Generate 1 unit x 2 kelas = 2 rows
    const first = await service.bulkCreateHarga(1, {
      unitIds: [5],
      kelasIds: [1, 2],
      jasaSarana: 80000,
      bhp: 20000,
      jasaDokter: 50000,
      jasaNakes: 25000,
      berlakuMulai: '2026-01-01',
      modeDuplikat: 'SKIP',
      status: StatusAktifMaster.AKTIF,
    });
    expect(first.createdCount).toBe(2);
    expect(savedHarga).toHaveLength(2);
    expect(savedHarga[0].totalTarif).toBe('175000.00');

    // Run again with OVERWRITE
    const second = await service.bulkCreateHarga(1, {
      unitIds: [5],
      kelasIds: [1, 2],
      jasaSarana: 90000,
      bhp: 20000,
      jasaDokter: 60000,
      jasaNakes: 30000,
      berlakuMulai: '2026-01-01',
      modeDuplikat: 'OVERWRITE',
    });
    expect(second.updatedCount).toBe(2);
    expect(second.createdCount).toBe(0);
    expect(savedHarga[0].totalTarif).toBe('200000.00');
  });
});
