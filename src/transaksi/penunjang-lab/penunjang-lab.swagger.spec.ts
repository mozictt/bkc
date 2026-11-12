import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { PermissionGuard } from '@src/permissions/guards/permission.guard';
import { ParameterLabController } from '@src/master-simrs/parameter-lab/controller/parameter-lab.controller';
import { ParameterLabService } from '@src/master-simrs/parameter-lab/services/parameter-lab.service';
import { CreateLabParameterDto } from '@src/master-simrs/parameter-lab/dto/parameter-lab.dto';
import { PenunjangLabController } from './controller/penunjang-lab.controller';
import { PenunjangLabService } from './services/penunjang-lab.service';
import {
  CreatePenunjangLabDto,
  PreviewTindakanLabDto,
} from './dto/penunjang-lab.dto';

describe('Swagger OpenAPI & Validasi DTO Master Parameter Lab & Penunjang Lab', () => {
  it('menghasilkan dokumen Swagger OpenAPI lengkap untuk endpoint Parameter Lab & Penunjang Lab', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ParameterLabController, PenunjangLabController],
      providers: [
        { provide: ParameterLabService, useValue: {} },
        { provide: PenunjangLabService, useValue: {} },
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

    expect(document.paths['/master/parameter-lab']).toBeDefined();
    expect(document.paths['/master/parameter-lab/options']).toBeDefined();
    expect(
      document.paths['/master/parameter-lab/tindakan-overview'],
    ).toBeDefined();
    expect(
      document.paths['/master/parameter-lab/tindakan/{tindakanId}/mapping'],
    ).toBeDefined();
    expect(
      document.paths['/master/parameter-lab/tindakan/{tindakanId}/quick-add'],
    ).toBeDefined();
    expect(document.paths['/transaksi/penunjang-lab']).toBeDefined();
    expect(
      document.paths['/transaksi/penunjang-lab/kunjungan-eligible'],
    ).toBeDefined();
    expect(
      document.paths['/transaksi/penunjang-lab/preview-tindakan'],
    ).toBeDefined();
    expect(document.paths['/transaksi/penunjang-lab/{id}']).toBeDefined();
    expect(document.paths['/transaksi/penunjang-lab/{id}/hasil']).toBeDefined();
    expect(
      document.paths['/transaksi/penunjang-lab/{id}/verifikasi'],
    ).toBeDefined();
    expect(document.paths['/transaksi/penunjang-lab/{id}/batal']).toBeDefined();

    const schemas = document.components?.schemas ?? {};
    expect(schemas.CreateLabParameterDto).toBeDefined();
    expect(schemas.SaveTindakanParameterMappingDto).toBeDefined();
    expect(schemas.CreatePenunjangLabDto).toBeDefined();
    expect(schemas.SaveHasilPenunjangLabDto).toBeDefined();

    await app.close();
  });

  it('memvalidasi DTO PreviewTindakanLabDto, CreateLabParameterDto, & CreatePenunjangLabDto', async () => {
    const pipe = new ValidationPipe({ whitelist: true, transform: true });

    const preview = (await pipe.transform(
      { pendaftaranId: '15', tindakanIds: '1, 2, 5' },
      { type: 'query', metatype: PreviewTindakanLabDto },
    )) as PreviewTindakanLabDto;
    expect(preview.pendaftaranId).toBe(15);
    expect(preview.tindakanIds).toEqual([1, 2, 5]);

    const paramDto = (await pipe.transform(
      {
        kode: ' HB ',
        nama: ' Hemoglobin ',
        satuan: ' g/dL ',
        rujukanList: [
          { jenisKelamin: 'L', nilaiMin: '13.5', nilaiMax: '17.5' },
        ],
      },
      { type: 'body', metatype: CreateLabParameterDto },
    )) as CreateLabParameterDto;
    expect(paramDto.kode).toBe('HB');
    expect(paramDto.rujukanList?.[0]?.nilaiMin).toBe(13.5);

    const createDto = (await pipe.transform(
      {
        pendaftaranId: '77',
        unitLabId: null,
        tindakanIds: ['9'],
        tandaiSelesaiInput: true,
        hasilInputs: [{ tindakanId: 9, parameterId: 101, hasilNilai: ' 14.2 ' }],
      },
      { type: 'body', metatype: CreatePenunjangLabDto },
    )) as CreatePenunjangLabDto;
    expect(createDto.unitLabId).toBeNull();
    expect(createDto.tindakanIds).toEqual([9]);
    expect(createDto.hasilInputs?.[0]?.hasilNilai).toBe('14.2');
  });
});
