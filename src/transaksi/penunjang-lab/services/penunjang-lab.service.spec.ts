import { BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { PenunjangLab } from '@entities/penunjang-lab.entity';
import { PenunjangLabItem } from '@entities/penunjang-lab-item.entity';
import { PenunjangLabHasil } from '@entities/penunjang-lab-hasil.entity';
import { Pendaftaran } from '@entities/pendaftaran.entity';
import { Unit } from '@entities/unit.entity';
import { Dokter } from '@entities/dokter.entity';
import { Pegawai } from '@entities/pegawai.entity';
import { TarifTindakan } from '@entities/tarif-tindakan.entity';
import { TarifLayanan } from '@entities/tarif-layanan.entity';
import { LabTindakanParameter } from '@entities/lab-tindakan-parameter.entity';
import { LabParameterRujukan } from '@entities/lab-parameter-rujukan.entity';
import {
  FlagHasilLab,
  JenisTarif,
  StatusPenunjangLab,
  TipeHasilLab,
} from '@src/master-simrs/constants/simrs.enum';
import {
  StatusKunjungan,
  StatusPembayaranKunjungan,
} from '@src/transaksi/pendaftaran/constants/pendaftaran.enum';
import {
  assertPendaftaranEligibleForLab,
  isPendaftaranEligibleForLab,
} from '../helpers/penunjang-lab.helper';
import { PenunjangLabService } from './penunjang-lab.service';

describe('PenunjangLabService & Helper Eligibilitas Kunjungan', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';

  it('hanya mengizinkan kunjungan yang masih diperiksa atau belum bayar (menolak SELESAI+LUNAS dan BATAL)', () => {
    expect(
      isPendaftaranEligibleForLab({
        statusKunjungan: StatusKunjungan.DALAM_PELAYANAN,
        statusPembayaran: StatusPembayaranKunjungan.LUNAS,
      }),
    ).toBe(true);

    expect(
      isPendaftaranEligibleForLab({
        statusKunjungan: StatusKunjungan.SELESAI,
        statusPembayaran: StatusPembayaranKunjungan.BELUM_BAYAR,
      }),
    ).toBe(true);

    expect(() =>
      assertPendaftaranEligibleForLab({
        noRegistrasi: 'REG-20261111-0001',
        statusKunjungan: StatusKunjungan.SELESAI,
        statusPembayaran: StatusPembayaranKunjungan.LUNAS,
      }),
    ).toThrow(BadRequestException);

    expect(() =>
      assertPendaftaranEligibleForLab({
        noRegistrasi: 'REG-20261111-0002',
        statusKunjungan: StatusKunjungan.BATAL,
        statusPembayaran: StatusPembayaranKunjungan.BELUM_BAYAR,
      }),
    ).toThrow(BadRequestException);
  });

  it('membuat transaksi penunjang lab lengkap dengan snapshot tarif, parameter Darah Lengkap, dan flag abnormal langsung', async () => {
    const savedHeaderList: Array<Record<string, unknown>> = [];
    const savedItemList: Array<Record<string, unknown>> = [];
    const savedHasilList: Array<Record<string, unknown>> = [];

    const pendaftaranObj = {
      id: 77,
      tenantId,
      noRegistrasi: 'REG-20261111-0077',
      pasienId: 500,
      unitSaatIniId: 3,
      dokterSaatIniId: 8,
      kelasSaatIniId: 2,
      penjaminId: 4,
      statusKunjungan: StatusKunjungan.DALAM_PELAYANAN,
      statusPembayaran: StatusPembayaranKunjungan.BELUM_BAYAR,
      pasien: {
        id: 500,
        noRm: '00000500',
        penduduk: {
          namaLengkap: 'Budi Santoso',
          jenisKelamin: 'L',
          tanggalLahir: '1990-05-10',
        },
      },
    };

    const pendaftaranRepo = {
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(pendaftaranObj),
      })),
    };

    const tindakanRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 9,
          kode: 'LAB-DL',
          nama: 'Darah Lengkap',
          jenisTarif: JenisTarif.LABORATORIUM,
          satuan: 'Paket',
          status: 'Y',
        },
      ]),
    };

    const hargaRepo = {
      createQueryBuilder: jest.fn(() => ({
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 21,
            tindakanId: 9,
            unitId: null,
            penjaminId: 4,
            kelasId: 2,
            jasaSarana: '60000.00',
            bhp: '15000.00',
            jasaDokter: '25000.00',
            jasaNakes: '20000.00',
            totalTarif: '120000.00',
            berlakuMulai: '2026-01-01',
            berlakuSampai: null,
            status: 'Y',
          },
        ]),
      })),
    };

    const mappingRepo = {
      createQueryBuilder: jest.fn(() => ({
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 1,
            tindakanId: 9,
            parameterId: 101,
            urutan: 1,
            isWajib: true,
            subGrupLabel: 'Hematologi Rutin',
            parameter: {
              id: 101,
              kode: 'HB',
              nama: 'Hemoglobin',
              grup: 'Hematologi',
              satuan: 'g/dL',
              tipeHasil: TipeHasilLab.NUMERIC,
              opsiPilihan: null,
              desimal: 1,
            },
          },
          {
            id: 2,
            tindakanId: 9,
            parameterId: 102,
            urutan: 2,
            isWajib: true,
            subGrupLabel: 'Hematologi Rutin',
            parameter: {
              id: 102,
              kode: 'LEU',
              nama: 'Leukosit',
              grup: 'Hematologi',
              satuan: '10^3/uL',
              tipeHasil: TipeHasilLab.NUMERIC,
              opsiPilihan: null,
              desimal: 1,
            },
          },
        ]),
      })),
    };

    const rujukanRepo = {
      find: jest.fn().mockResolvedValue([
        {
          id: 501,
          parameterId: 101,
          jenisKelamin: 'L',
          usiaMinHari: 5110,
          usiaMaxHari: 99999,
          nilaiMin: '13.5',
          nilaiMax: '17.5',
          kritisMin: '7.0',
          kritisMax: '21.0',
        },
        {
          id: 502,
          parameterId: 102,
          jenisKelamin: 'ALL',
          usiaMinHari: 0,
          usiaMaxHari: 99999,
          nilaiMin: '4.0',
          nilaiMax: '10.0',
          kritisMin: '1.5',
          kritisMax: '30.0',
        },
      ]),
    };

    const repo = {
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          ...(savedHeaderList[savedHeaderList.length - 1] || { id: 888 }),
        }),
      })),
    };

    const itemRepo = {
      find: jest.fn(() => Promise.resolve(savedItemList)),
    };
    const hasilRepo = {
      find: jest.fn(() => Promise.resolve(savedHasilList)),
    };

    const txManager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(pendaftaranObj) // lock pendaftaran
        .mockResolvedValueOnce(null), // noLab collision check
      query: jest.fn().mockResolvedValue([{ last_value: 1 }]),
      getRepository: jest.fn((entity: unknown) => {
        if (entity === PenunjangLab) {
          return {
            create: jest.fn((d: Record<string, unknown>) => d),
            save: jest.fn((d: Record<string, unknown>) => {
              const saved = { id: 888, ...d };
              if (savedHeaderList.length === 0) savedHeaderList.push(saved);
              else savedHeaderList[0] = saved;
              return Promise.resolve(saved);
            }),
          };
        }
        if (entity === PenunjangLabItem) {
          return {
            create: jest.fn((d: Record<string, unknown>) => d),
            save: jest.fn((d: Record<string, unknown>) => {
              const saved = { id: 901, ...d };
              savedItemList.push(saved);
              return Promise.resolve(saved);
            }),
          };
        }
        return {
          create: jest.fn((d: Record<string, unknown>) => d),
          save: jest.fn((rows: Array<Record<string, unknown>>) => {
            savedHasilList.push(...rows);
            return Promise.resolve(rows);
          }),
        };
      }),
    };

    const dataSource = {
      transaction: jest.fn((cb: (m: typeof txManager) => Promise<unknown>) =>
        cb(txManager),
      ),
    };
    const tenantService = {
      getTenantId: jest.fn(() => tenantId),
      getUserId: jest.fn(() => 7),
    };

    const service = new PenunjangLabService(
      repo as unknown as Repository<PenunjangLab>,
      itemRepo as unknown as Repository<PenunjangLabItem>,
      hasilRepo as unknown as Repository<PenunjangLabHasil>,
      pendaftaranRepo as unknown as Repository<Pendaftaran>,
      {} as Repository<Unit>,
      {} as Repository<Dokter>,
      {} as Repository<Pegawai>,
      tindakanRepo as unknown as Repository<TarifTindakan>,
      hargaRepo as unknown as Repository<TarifLayanan>,
      mappingRepo as unknown as Repository<LabTindakanParameter>,
      rujukanRepo as unknown as Repository<LabParameterRujukan>,
      dataSource as unknown as DataSource,
      tenantService as unknown as TenantContextService,
    );

    const created = await service.create({
      pendaftaranId: 77,
      tindakanIds: [9],
      tandaiSelesaiInput: true,
      hasilInputs: [
        { tindakanId: 9, parameterId: 101, hasilNilai: '11.0' }, // LOW (< 13.5)
        { tindakanId: 9, parameterId: 102, hasilNilai: '8.2' }, // NORMAL
      ],
    });

    expect(savedHeaderList[0].statusLab).toBe(StatusPenunjangLab.SELESAI_INPUT);
    expect(savedHeaderList[0].totalTarif).toBe('120000.00');
    expect(savedHeaderList[0].totalJasaDokter).toBe('25000.00');
    expect(savedHeaderList[0].totalJasaNakes).toBe('20000.00');
    expect(savedHasilList).toHaveLength(2);
    expect(savedHasilList[0].flagAbnormal).toBe(FlagHasilLab.LOW);
    expect(savedHasilList[1].flagAbnormal).toBe(FlagHasilLab.NORMAL);
    expect(created.id).toBe(888);
  });

  it('menyediakan input hasil langsung untuk tindakan tanpa anakan parameter serta auto-backfill pada order lama', async () => {
    const tindakanTanpaAnakan = {
      id: 19,
      kode: 'LAB008',
      nama: 'Darah Rutin',
      jenisTarif: JenisTarif.LABORATORIUM,
      kelompokTarif: 'Hematologi',
      satuan: 'Pemeriksaan',
      status: 'Y',
    };
    const pendaftaranObj = {
      id: 78,
      noRegistrasi: 'REG-20261111-0006',
      pasienId: 12,
      unitSaatIniId: 3,
      dokterSaatIniId: 4,
      penjaminId: 2,
      kelasSaatIniId: 1,
      statusKunjungan: StatusKunjungan.DALAM_PELAYANAN,
      statusPembayaran: StatusPembayaranKunjungan.BELUM_BAYAR,
      pasien: { penduduk: { jenisKelamin: 'P', tanggalLahir: '1998-04-01' } },
    };

    const pendaftaranRepo = {
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(pendaftaranObj),
      })),
    };
    const tindakanRepo = {
      find: jest.fn().mockResolvedValue([tindakanTanpaAnakan]),
    };
    const hargaRepo = {
      createQueryBuilder: jest.fn(() => ({
        leftJoin: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 21,
            tindakanId: 19,
            unitId: null,
            penjaminId: null,
            kelasId: null,
            jasaSarana: '70000.00',
            bhp: '10000.00',
            jasaDokter: '10000.00',
            jasaNakes: '10000.00',
            totalTarif: '100000.00',
            berlakuMulai: '2026-01-01',
            berlakuSampai: null,
            status: 'Y',
          },
        ]),
      })),
    };
    const mappingRepo = {
      createQueryBuilder: jest.fn(() => ({
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      })),
    };
    const rujukanRepo = { find: jest.fn().mockResolvedValue([]) };

    const savedHeaders: any[] = [];
    const savedItems: any[] = [];
    const savedHasils: any[] = [];

    const repo = {
      createQueryBuilder: jest.fn(() => ({
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn(() => Promise.resolve(savedHeaders[0])),
      })),
    };
    const itemRepo = { find: jest.fn(() => Promise.resolve(savedItems)) };
    const hasilRepo = {
      find: jest.fn(() => Promise.resolve([...savedHasils])),
      create: jest.fn((d: Record<string, unknown>) => d),
      save: jest.fn((rows: Array<Record<string, unknown>>) => {
        const mapped = rows.map((r, idx) => ({ id: 700 + idx, ...r }));
        savedHasils.push(...mapped);
        return Promise.resolve(mapped);
      }),
    };

    const txManager = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce(pendaftaranObj)
        .mockResolvedValueOnce(null),
      query: jest.fn().mockResolvedValue([{ last_value: 2 }]),
      getRepository: jest.fn((entity: unknown) => {
        if (entity === PenunjangLab) {
          return {
            create: jest.fn((d: Record<string, unknown>) => d),
            save: jest.fn((d: Record<string, unknown>) => {
              const saved = { id: 889, ...d };
              savedHeaders[0] = saved;
              return Promise.resolve(saved);
            }),
          };
        }
        if (entity === PenunjangLabItem) {
          return {
            create: jest.fn((d: Record<string, unknown>) => d),
            save: jest.fn((d: Record<string, unknown>) => {
              const saved = { id: 902, tindakan: tindakanTanpaAnakan, ...d };
              savedItems.push(saved);
              return Promise.resolve(saved);
            }),
          };
        }
        return {
          create: jest.fn((d: Record<string, unknown>) => d),
          save: jest.fn((rows: Array<Record<string, unknown>>) => {
            savedHasils.push(...rows.map((r, idx) => ({ id: 600 + idx, ...r })));
            return Promise.resolve(savedHasils);
          }),
        };
      }),
    };

    const dataSource = {
      transaction: jest.fn((cb: (m: typeof txManager) => Promise<unknown>) =>
        cb(txManager),
      ),
    };
    const tenantService = {
      getTenantId: jest.fn(() => tenantId),
      getUserId: jest.fn(() => 7),
    };

    const service = new PenunjangLabService(
      repo as unknown as Repository<PenunjangLab>,
      itemRepo as unknown as Repository<PenunjangLabItem>,
      hasilRepo as unknown as Repository<PenunjangLabHasil>,
      pendaftaranRepo as unknown as Repository<Pendaftaran>,
      {} as Repository<Unit>,
      {} as Repository<Dokter>,
      {} as Repository<Pegawai>,
      tindakanRepo as unknown as Repository<TarifTindakan>,
      hargaRepo as unknown as Repository<TarifLayanan>,
      mappingRepo as unknown as Repository<LabTindakanParameter>,
      rujukanRepo as unknown as Repository<LabParameterRujukan>,
      dataSource as unknown as DataSource,
      tenantService as unknown as TenantContextService,
    );

    const preview = await service.previewTindakanForKunjungan({
      pendaftaranId: 78,
      tindakanIds: [19],
    });
    expect(preview.items[0].parameters).toHaveLength(1);
    expect(preview.items[0].parameters[0].parameterId).toBeNull();
    expect(preview.items[0].parameters[0].nama).toBe('Darah Rutin');

    await service.create({
      pendaftaranId: 78,
      tindakanIds: [19],
      tandaiSelesaiInput: true,
      hasilInputs: [{ tindakanId: 19, parameterId: null, hasilNilai: 'Hb 13.8, Normal' }],
    });

    expect(savedHasils).toHaveLength(1);
    expect(savedHasils[0].parameterId).toBeNull();
    expect(savedHasils[0].namaParameterSnapshot).toBe('Darah Rutin');
    expect(savedHasils[0].hasilNilai).toBe('Hb 13.8, Normal');

    // Simulasikan order lama yang sempat tersimpan tanpa baris hasil (0 rows)
    savedHasils.length = 0;
    savedHeaders[0].statusLab = StatusPenunjangLab.DIPROSES;
    const loaded = await service.findOne(889);
    expect(loaded.hasilList).toHaveLength(1);
    expect(loaded.hasilList[0].parameterId).toBeNull();
    expect(loaded.hasilList[0].namaParameterSnapshot).toBe('Darah Rutin');
    expect(loaded.items[0].kelompokTarifSnapshot).toBe('Hematologi');
  });
});
