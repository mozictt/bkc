import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { PermissionGuard } from '@src/permissions/guards/permission.guard';
import { HariPraktik, SesiPraktik } from '../constants/simrs.enum';
import { JadwalDokterController } from './controller/jadwal-dokter.controller';
import { JadwalDokterService } from './services/jadwal-dokter.service';
import {
  BulkCreateJadwalDokterDto,
  CreateJadwalDokterDto,
} from './dto/create-jadwal-dokter.dto';
import { QueryOptionsJadwalDokterDto } from './dto/query-jadwal-dokter.dto';

describe('Swagger OpenAPI & Validasi DTO Master Jadwal Dokter', () => {
  it('menghasilkan dokumen Swagger OpenAPI JSON lengkap untuk endpoint & schema Jadwal Dokter', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [JadwalDokterController],
      providers: [{ provide: JadwalDokterService, useValue: {} }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    const config = new DocumentBuilder()
      .setTitle('API Documentation')
      .setVersion('1.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);

    expect(document.paths['/master/jadwal-dokter']).toBeDefined();
    expect(document.paths['/master/jadwal-dokter/options']).toBeDefined();
    expect(document.paths['/master/jadwal-dokter/mingguan']).toBeDefined();
    expect(document.paths['/master/jadwal-dokter/bulk']).toBeDefined();
    expect(document.paths['/master/jadwal-dokter/{id}']).toBeDefined();
    expect(document.paths['/master/jadwal-dokter/{id}/status']).toBeDefined();

    const schemas = document.components?.schemas ?? {};
    expect(schemas.CreateJadwalDokterDto).toBeDefined();
    expect(schemas.BulkCreateJadwalDokterDto).toBeDefined();
    expect(schemas.UpdateJadwalDokterDto).toBeDefined();
    expect(schemas.UpdateStatusJadwalDokterDto).toBeDefined();

    const listParams = (document.paths['/master/jadwal-dokter'].get
      ?.parameters ?? []) as Array<{ name: string }>;
    expect(listParams.map((p) => p.name)).toEqual(
      expect.arrayContaining(['dokterId', 'unitId', 'hari', 'sesi', 'status']),
    );

    const optionsParams = (document.paths['/master/jadwal-dokter/options'].get
      ?.parameters ?? []) as Array<{ name: string }>;
    expect(optionsParams.map((p) => p.name)).toEqual(
      expect.arrayContaining([
        'unitId',
        'dokterId',
        'hari',
        'tanggal',
        'sesi',
        'search',
      ]),
    );

    const mingguanParams = (document.paths['/master/jadwal-dokter/mingguan'].get
      ?.parameters ?? []) as Array<{ name: string }>;
    expect(mingguanParams.map((p) => p.name)).toEqual(
      expect.arrayContaining(['unitId', 'dokterId', 'sesi', 'search']),
    );

    await app.close();
  });

  it('memvalidasi dan menormalisasi DTO CreateJadwalDokterDto, BulkCreateJadwalDokterDto, dan QueryOptionsJadwalDokterDto', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      transform: true,
    });

    const singleDto = (await pipe.transform(
      {
        dokterId: '1',
        unitId: '2',
        hari: HariPraktik.SENIN,
        jamMulai: ' 08:00 ',
        jamSelesai: ' 12:00 ',
        sesi: SesiPraktik.PAGI,
        ruangan: ' Ruang Poli 1 ',
        kuotaJkn: '20',
        kuotaNonJkn: '10',
        durasiPerPasien: '15',
      },
      { type: 'body', metatype: CreateJadwalDokterDto },
    )) as CreateJadwalDokterDto;

    expect(singleDto.dokterId).toBe(1);
    expect(singleDto.unitId).toBe(2);
    expect(singleDto.jamMulai).toBe('08:00');
    expect(singleDto.jamSelesai).toBe('12:00');
    expect(singleDto.ruangan).toBe('Ruang Poli 1');
    expect(singleDto.kuotaJkn).toBe(20);
    expect(singleDto.durasiPerPasien).toBe(15);

    await expect(
      pipe.transform(
        {
          dokterId: 1,
          unitId: 2,
          hari: HariPraktik.SENIN,
          jamMulai: '25:00',
          jamSelesai: '12:00',
        },
        { type: 'body', metatype: CreateJadwalDokterDto },
      ),
    ).rejects.toThrow();

    await expect(
      pipe.transform(
        {
          dokterId: 1,
          unitId: 2,
          hariList: [HariPraktik.SENIN, HariPraktik.SENIN],
          jamMulai: '08:00',
          jamSelesai: '12:00',
        },
        { type: 'body', metatype: BulkCreateJadwalDokterDto },
      ),
    ).rejects.toThrow();

    const queryOptions = (await pipe.transform(
      {
        unitId: '5',
        tanggal: ' 2026-11-11 ',
      },
      { type: 'query', metatype: QueryOptionsJadwalDokterDto },
    )) as QueryOptionsJadwalDokterDto;

    expect(queryOptions.unitId).toBe(5);
    expect(queryOptions.tanggal).toBe('2026-11-11');
  });
});
