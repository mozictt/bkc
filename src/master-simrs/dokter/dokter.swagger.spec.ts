import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PendudukController } from '../penduduk/controller/penduduk.controller';
import { PendudukService } from '../penduduk/services/penduduk.service';
import { DokterController } from './controller/dokter.controller';
import { DokterService } from './services/dokter.service';
import { PegawaiController } from '@src/pegawai/pegawai.controller';
import { PegawaiService } from '@src/pegawai/pegawai.service';
import { PermissionGuard } from '@src/permissions/guards/permission.guard';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { CreateDokterDto } from './dto/create-dokter.dto';
import { QueryDokterDto } from './dto/query-dokter.dto';
import { CreatePendudukDto } from '../penduduk/dto/create-penduduk.dto';

describe('Swagger OpenAPI & Validasi DTO Master Dokter / Penduduk / Pegawai', () => {
  it('menghasilkan dokumen Swagger OpenAPI JSON yang lengkap untuk endpoint & schema baru', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PendudukController, DokterController, PegawaiController],
      providers: [
        { provide: PendudukService, useValue: {} },
        { provide: DokterService, useValue: {} },
        { provide: PegawaiService, useValue: {} },
      ],
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

    expect(document.paths['/master/penduduk']).toBeDefined();
    expect(document.paths['/master/penduduk/nik/{nik}']).toBeDefined();
    expect(document.paths['/master/penduduk/{id}']).toBeDefined();
    expect(document.paths['/master/dokter']).toBeDefined();
    expect(document.paths['/master/dokter/available-pegawai']).toBeDefined();
    expect(document.paths['/master/dokter/available-penduduk']).toBeDefined();
    expect(document.paths['/master/dokter/{id}']).toBeDefined();
    expect(document.paths['/pegawai']).toBeDefined();

    const schemas = document.components?.schemas ?? {};
    expect(schemas.CreatePendudukDto).toBeDefined();
    expect(schemas.UpdatePendudukDto).toBeDefined();
    expect(schemas.CreateDokterDto).toBeDefined();
    expect(schemas.UpdateDokterDto).toBeDefined();
    expect(schemas.CreatePegawaiForDokterDto).toBeDefined();
    expect(schemas.CreatePegawaiDto).toBeDefined();
    expect(schemas.UpdatePegawaiDto).toBeDefined();

    await app.close();
  });

  it('memvalidasi NIK 16 digit dan nested DTO CreateDokterDto melalui ValidationPipe', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      transform: true,
    });

    await expect(
      pipe.transform(
        {
          nik: '12345',
          namaLengkap: 'Budi',
          jenisKelamin: 'L',
        },
        { type: 'body', metatype: CreatePendudukDto },
      ),
    ).rejects.toThrow();

    const validDokter = (await pipe.transform(
      {
        kodeDokter: ' DOK-010 ',
        penduduk: {
          nik: '3273011505900001',
          namaLengkap: ' Siti Aminah ',
          jenisKelamin: 'P',
        },
        pegawai: {
          nip: ' PEG-010 ',
        },
      },
      { type: 'body', metatype: CreateDokterDto },
    )) as CreateDokterDto;

    expect(validDokter.kodeDokter).toBe('DOK-010');
    expect(validDokter.penduduk?.namaLengkap).toBe('Siti Aminah');
    expect(validDokter.pegawai?.nip).toBe('PEG-010');

    const queryDokter = (await pipe.transform(
      { unitId: '2', status: 'Y' },
      { type: 'query', metatype: QueryDokterDto },
    )) as QueryDokterDto;
    expect(queryDokter.unitId).toBe(2);

    await expect(
      pipe.transform({ unitId: '0' }, { type: 'query', metatype: QueryDokterDto }),
    ).rejects.toThrow();
  });
});
