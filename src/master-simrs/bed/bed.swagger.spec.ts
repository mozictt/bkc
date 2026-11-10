import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { PermissionGuard } from '@src/permissions/guards/permission.guard';
import { KelasController } from '../kelas/controller/kelas.controller';
import { KelasService } from '../kelas/services/kelas.service';
import { UnitController } from '../unit/controller/unit.controller';
import { UnitService } from '../unit/services/unit.service';
import { BedController } from './controller/bed.controller';
import { BedService } from './services/bed.service';
import { CreateBedDto } from './dto/create-bed.dto';
import { CreateKelasDto } from '../kelas/dto/create-kelas.dto';

describe('Swagger OpenAPI & Validasi DTO Master Kelas, Unit, dan Bed', () => {
  it('menghasilkan dokumen Swagger OpenAPI JSON lengkap untuk endpoint & schema Kelas, Unit, Bed', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [KelasController, UnitController, BedController],
      providers: [
        { provide: KelasService, useValue: {} },
        { provide: UnitService, useValue: {} },
        { provide: BedService, useValue: {} },
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

    expect(document.paths['/master/kelas']).toBeDefined();
    expect(document.paths['/master/kelas/options']).toBeDefined();
    expect(document.paths['/master/kelas/{id}']).toBeDefined();
    expect(document.paths['/master/unit']).toBeDefined();
    expect(document.paths['/master/unit/options']).toBeDefined();
    expect(document.paths['/master/unit/{id}']).toBeDefined();
    expect(document.paths['/master/bed']).toBeDefined();
    expect(document.paths['/master/bed/options']).toBeDefined();
    expect(document.paths['/master/bed/summary']).toBeDefined();
    expect(document.paths['/master/bed/{id}']).toBeDefined();
    expect(
      document.paths['/master/bed/{id}/status-ketersediaan'],
    ).toBeDefined();

    const schemas = document.components?.schemas ?? {};
    expect(schemas.CreateKelasDto).toBeDefined();
    expect(schemas.UpdateKelasDto).toBeDefined();
    expect(schemas.CreateUnitDto).toBeDefined();
    expect(schemas.UpdateUnitDto).toBeDefined();
    expect(schemas.CreateBedDto).toBeDefined();
    expect(schemas.UpdateBedDto).toBeDefined();
    expect(schemas.UpdateStatusKetersediaanBedDto).toBeDefined();

    await app.close();
  });

  it('memvalidasi DTO CreateKelasDto dan CreateBedDto melalui ValidationPipe', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      transform: true,
    });

    const kelas = (await pipe.transform(
      {
        kode: ' KL1 ',
        nama: ' Kelas 1 ',
        tarifAkomodasi: '350000',
      },
      { type: 'body', metatype: CreateKelasDto },
    )) as CreateKelasDto;

    expect(kelas.kode).toBe('KL1');
    expect(kelas.nama).toBe('Kelas 1');
    expect(kelas.tarifAkomodasi).toBe(350000);

    const bed = (await pipe.transform(
      {
        kode: ' MLT-101-01 ',
        nama: ' Bed 01 ',
        unitId: '10',
        kelasId: '1',
      },
      { type: 'body', metatype: CreateBedDto },
    )) as CreateBedDto;

    expect(bed.kode).toBe('MLT-101-01');
    expect(bed.unitId).toBe(10);
    expect(bed.kelasId).toBe(1);
  });
});

