import { BadRequestException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { LabParameter } from '@entities/lab-parameter.entity';
import { LabParameterRujukan } from '@entities/lab-parameter-rujukan.entity';
import { LabTindakanParameter } from '@entities/lab-tindakan-parameter.entity';
import { TarifTindakan } from '@entities/tarif-tindakan.entity';
import {
  FlagHasilLab,
  JenisTarif,
  TipeHasilLab,
} from '../../constants/simrs.enum';
import {
  evaluateHasilLab,
  resolveRujukanPasien,
} from '../helpers/lab-parameter.helper';
import { ParameterLabService } from './parameter-lab.service';

describe('ParameterLabService & Helper Rujukan/Evaluasi Lab', () => {
  const tenantId = '11111111-1111-1111-1111-111111111111';

  it('memilih rujukan paling spesifik berdasarkan gender dan rentang umur pasien', () => {
    const rujukanList = [
      {
        id: 1,
        jenisKelamin: 'ALL',
        usiaMinHari: 0,
        usiaMaxHari: 99999,
        nilaiMin: '11.0',
        nilaiMax: '16.0',
      },
      {
        id: 2,
        jenisKelamin: 'L',
        usiaMinHari: 5110, // >= 14 thn
        usiaMaxHari: 99999,
        nilaiMin: '13.5',
        nilaiMax: '17.5',
      },
      {
        id: 3,
        jenisKelamin: 'P',
        usiaMinHari: 5110,
        usiaMaxHari: 99999,
        nilaiMin: '12.0',
        nilaiMax: '15.5',
      },
      {
        id: 4,
        jenisKelamin: 'ALL',
        usiaMinHari: 0,
        usiaMaxHari: 28, // Neonatus
        nilaiMin: '14.0',
        nilaiMax: '22.0',
      },
    ];

    // Pria dewasa -> id 2
    const priaDewasa = resolveRujukanPasien(
      rujukanList,
      'L',
      '1995-01-01',
      '2026-11-11',
    );
    expect(priaDewasa?.id).toBe(2);

    // Wanita dewasa -> id 3
    const wanitaDewasa = resolveRujukanPasien(
      rujukanList,
      'P',
      '1995-01-01',
      '2026-11-11',
    );
    expect(wanitaDewasa?.id).toBe(3);

    // Bayi baru lahir 10 hari -> id 4 (rentang usia tersempit)
    const bayi = resolveRujukanPasien(
      rujukanList,
      'L',
      '2026-11-01',
      '2026-11-11',
    );
    expect(bayi?.id).toBe(4);
  });

  it('mengevaluasi flag hasil lab NUMERIC dan OPTION secara akurat', () => {
    const numRef = {
      nilaiMin: 13.5,
      nilaiMax: 17.5,
      kritisMin: 7.0,
      kritisMax: 21.0,
    };

    expect(
      evaluateHasilLab('14,5', TipeHasilLab.NUMERIC, 1, numRef, 'Hemoglobin'),
    ).toEqual({
      hasilNilai: '14.5',
      hasilAngka: '14.5000',
      flagAbnormal: FlagHasilLab.NORMAL,
      isKritis: false,
    });

    expect(
      evaluateHasilLab('11.2', TipeHasilLab.NUMERIC, 1, numRef, 'Hemoglobin'),
    ).toEqual({
      hasilNilai: '11.2',
      hasilAngka: '11.2000',
      flagAbnormal: FlagHasilLab.LOW,
      isKritis: false,
    });

    expect(
      evaluateHasilLab('6.5', TipeHasilLab.NUMERIC, 1, numRef, 'Hemoglobin'),
    ).toEqual({
      hasilNilai: '6.5',
      hasilAngka: '6.5000',
      flagAbnormal: FlagHasilLab.CRITICAL_LOW,
      isKritis: true,
    });

    expect(() =>
      evaluateHasilLab('abc', TipeHasilLab.NUMERIC, 1, numRef, 'Hemoglobin'),
    ).toThrow(BadRequestException);

    const optRes = evaluateHasilLab(
      'Positif (+)',
      TipeHasilLab.OPTION,
      0,
      { nilaiNormalText: 'Negatif' },
      'Protein Urin',
    );
    expect(optRes.flagAbnormal).toBe(FlagHasilLab.ABNORMAL);
    expect(optRes.isKritis).toBe(false);

    // Parameter tanpa batas min/max numerik (mis. rujukan teks "normal") menerima hasil kualitatif Positif/Negatif/Normal
    const qualNormal = evaluateHasilLab(
      'Normal',
      TipeHasilLab.NUMERIC,
      2,
      { nilaiMin: null, nilaiMax: null, nilaiNormalText: 'normal' },
      'Darah Rutin',
    );
    expect(qualNormal.flagAbnormal).toBe(FlagHasilLab.NORMAL);
    expect(qualNormal.hasilNilai).toBe('Normal');

    const qualPos = evaluateHasilLab(
      'Positif',
      TipeHasilLab.NUMERIC,
      2,
      { nilaiMin: null, nilaiMax: null, nilaiNormalText: 'normal' },
      'Darah Rutin',
    );
    expect(qualPos.flagAbnormal).toBe(FlagHasilLab.ABNORMAL);
    expect(qualPos.hasilNilai).toBe('Positif');
  });

  it('menolak mapping parameter untuk tindakan non-LABORATORIUM dan menyimpan urutan mapping Darah Lengkap', async () => {
    const repo = {
      find: jest.fn().mockResolvedValue([
        { id: 1, nama: 'Hemoglobin', status: 'Y' },
        { id: 2, nama: 'Leukosit', status: 'Y' },
      ]),
    };
    const rujukanRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    const savedMappings: Array<Record<string, unknown>> = [];
    const mappingRepo = {
      createQueryBuilder: jest.fn(() => ({
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 11,
            tindakanId: 9,
            parameterId: 1,
            urutan: 1,
            isWajib: true,
            parameter: { id: 1, kode: 'HB', nama: 'Hemoglobin' },
          },
          {
            id: 12,
            tindakanId: 9,
            parameterId: 2,
            urutan: 2,
            isWajib: true,
            parameter: { id: 2, kode: 'LEU', nama: 'Leukosit' },
          },
        ]),
      })),
    };
    const tindakanRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 9,
        tenantId,
        kode: 'LAB-DL',
        nama: 'Darah Lengkap',
        jenisTarif: JenisTarif.LABORATORIUM,
        status: 'Y',
      }),
    };
    const txManager = {
      getRepository: jest.fn(() => ({
        delete: jest.fn().mockResolvedValue({}),
        create: jest.fn((data: Record<string, unknown>) => data),
        save: jest.fn((rows: Array<Record<string, unknown>>) => {
          savedMappings.push(...rows);
          return Promise.resolve(rows);
        }),
      })),
    };
    const dataSource = {
      transaction: jest.fn((cb: (m: typeof txManager) => Promise<unknown>) =>
        cb(txManager),
      ),
    };
    const tenantService = { getTenantId: jest.fn(() => tenantId) };

    const service = new ParameterLabService(
      repo as unknown as Repository<LabParameter>,
      rujukanRepo as unknown as Repository<LabParameterRujukan>,
      mappingRepo as unknown as Repository<LabTindakanParameter>,
      tindakanRepo as unknown as Repository<TarifTindakan>,
      dataSource as unknown as DataSource,
      tenantService as unknown as TenantContextService,
    );

    const mapped = await service.saveMappingForTindakan(9, {
      items: [
        { parameterId: 1, urutan: 1, isWajib: true },
        { parameterId: 2, urutan: 2, isWajib: true },
      ],
    });

    expect(savedMappings).toHaveLength(2);
    expect(mapped.items).toHaveLength(2);

    tindakanRepo.findOne.mockResolvedValueOnce({
      id: 15,
      tenantId,
      nama: 'Konsultasi Poli',
      jenisTarif: JenisTarif.BIASA,
      status: 'Y',
    });

    await expect(
      service.saveMappingForTindakan(15, {
        items: [{ parameterId: 1, urutan: 1 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
