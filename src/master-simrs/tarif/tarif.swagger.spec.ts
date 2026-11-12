import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { PermissionGuard } from '@src/permissions/guards/permission.guard';
import { JenisTarif } from '../constants/simrs.enum';
import { TarifController } from './controller/tarif.controller';
import { TarifService } from './services/tarif.service';
import { CreateTarifTindakanDto } from './dto/create-tarif-tindakan.dto';
import {
  CreateTarifLayananDto,
  UpdateTarifLayananDto,
} from './dto/tarif-layanan.dto';

describe('Swagger OpenAPI & Validasi DTO Master Tarif', () => {
  it('menghasilkan dokumen Swagger OpenAPI lengkap untuk endpoint & schema Master Tarif', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TarifController],
      providers: [{ provide: TarifService, useValue: {} }],
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

    expect(document.paths['/master/tarif']).toBeDefined();
    expect(document.paths['/master/tarif/options']).toBeDefined();
    expect(document.paths['/master/tarif/resolve']).toBeDefined();
    expect(document.paths['/master/tarif/{id}']).toBeDefined();
    expect(document.paths['/master/tarif/{id}/harga']).toBeDefined();
    expect(document.paths['/master/tarif/{id}/harga/bulk']).toBeDefined();
    expect(document.paths['/master/tarif/harga/{hargaId}']).toBeDefined();

    const schemas = document.components?.schemas ?? {};
    expect(schemas.CreateTarifTindakanDto).toBeDefined();
    expect(schemas.UpdateTarifTindakanDto).toBeDefined();
    expect(schemas.CreateTarifLayananDto).toBeDefined();
    expect(schemas.UpdateTarifLayananDto).toBeDefined();
    expect(schemas.BulkCreateTarifLayananDto).toBeDefined();

    await app.close();
  });

  it('memvalidasi DTO CreateTarifTindakanDto & CreateTarifLayananDto termasuk nilai null untuk wildcard dimensi', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      transform: true,
    });

    const tindakan = (await pipe.transform(
      {
        kode: ' LAB-HB ',
        nama: ' Pemeriksaan Hemoglobin ',
        jenisTarif: JenisTarif.LABORATORIUM,
        tarifDefault: {
          jasaSarana: '25000',
          bhp: '5000',
          jasaDokter: '15000',
          jasaNakes: '10000',
        },
      },
      { type: 'body', metatype: CreateTarifTindakanDto },
    )) as CreateTarifTindakanDto;

    expect(tindakan.kode).toBe('LAB-HB');
    expect(tindakan.nama).toBe('Pemeriksaan Hemoglobin');
    expect(tindakan.tarifDefault?.jasaDokter).toBe(15000);
    expect(tindakan.tarifDefault?.jasaNakes).toBe(10000);

    const hargaWildcard = (await pipe.transform(
      {
        unitId: null,
        penjaminId: '2',
        kelasId: '',
        jasaSarana: 50000,
        jasaDokter: 40000,
        jasaNakes: 10000,
        berlakuSampai: null,
      },
      { type: 'body', metatype: UpdateTarifLayananDto },
    )) as CreateTarifLayananDto;

    expect(hargaWildcard.unitId).toBeNull();
    expect(hargaWildcard.penjaminId).toBe(2);
    expect(hargaWildcard.kelasId).toBeNull();
    expect(hargaWildcard.berlakuSampai).toBeNull();
  });
});
