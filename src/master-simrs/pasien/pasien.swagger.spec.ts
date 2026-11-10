import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { PermissionGuard } from '@src/permissions/guards/permission.guard';
import { PenjaminController } from '../penjamin/controller/penjamin.controller';
import { PenjaminService } from '../penjamin/services/penjamin.service';
import { PasienController } from './controller/pasien.controller';
import { PasienService } from './services/pasien.service';
import { CreatePasienDto } from './dto/create-pasien.dto';

describe('Swagger OpenAPI & Validasi DTO Master Pasien + Master Penjamin', () => {
  it('menghasilkan dokumen Swagger OpenAPI JSON lengkap untuk endpoint & schema Pasien + Penjamin (termasuk kelasHakId)', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PasienController, PenjaminController],
      providers: [
        { provide: PasienService, useValue: {} },
        { provide: PenjaminService, useValue: {} },
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

    expect(document.paths['/master/penjamin']).toBeDefined();
    expect(document.paths['/master/penjamin/options']).toBeDefined();
    expect(document.paths['/master/penjamin/{id}']).toBeDefined();
    expect(document.paths['/master/pasien']).toBeDefined();
    expect(document.paths['/master/pasien/lookup']).toBeDefined();
    expect(document.paths['/master/pasien/no-rm/{noRm}']).toBeDefined();
    expect(document.paths['/master/pasien/{id}']).toBeDefined();
    expect(document.paths['/master/pasien/{id}/penjamin']).toBeDefined();
    expect(
      document.paths['/master/pasien/{id}/penjamin/{penjaminId}'],
    ).toBeDefined();

    const schemas = document.components?.schemas as Record<
      string,
      { properties?: Record<string, unknown> }
    >;
    expect(schemas.CreatePenjaminDto).toBeDefined();
    expect(schemas.UpdatePenjaminDto).toBeDefined();
    expect(schemas.CreatePasienDto).toBeDefined();
    expect(schemas.UpdatePasienDto).toBeDefined();
    expect(
      schemas.CreatePasienPenjaminItemDto?.properties?.kelasHakId,
    ).toBeDefined();
    expect(schemas.UpdatePasienPenjaminItemDto).toBeDefined();

    await app.close();
  });

  it('menormalisasi string kosong nik & kelasHakId serta memvalidasi nested penjaminList', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      transform: true,
    });

    const validBaby = (await pipe.transform(
      {
        isBayiBaruLahir: true,
        penduduk: {
          nik: '   ',
          namaLengkap: ' By. Ny. Ani ',
          jenisKelamin: 'P',
        },
        penjaminList: [
          {
            penjaminId: 1,
            noKartu: ' 0001234567890 ',
            kelasHakId: '',
            isUtama: true,
          },
          {
            penjaminId: 2,
            noKartu: 'PRU-001',
            kelasHakId: '3',
          },
        ],
      },
      { type: 'body', metatype: CreatePasienDto },
    )) as CreatePasienDto;

    expect(validBaby.penduduk?.nik).toBeUndefined();
    expect(validBaby.penduduk?.namaLengkap).toBe('By. Ny. Ani');
    expect(validBaby.penjaminList?.[0].penjaminId).toBe(1);
    expect(validBaby.penjaminList?.[0].noKartu).toBe('0001234567890');
    expect(validBaby.penjaminList?.[0].kelasHakId).toBeUndefined();
    expect(validBaby.penjaminList?.[1].kelasHakId).toBe(3);
  });
});
