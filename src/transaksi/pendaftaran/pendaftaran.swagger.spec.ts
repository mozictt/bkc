import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { PermissionGuard } from '@src/permissions/guards/permission.guard';
import {
  JenisKelamin,
  JenisPenjamin,
} from '@src/master-simrs/constants/simrs.enum';
import { PendaftaranController } from './controller/pendaftaran.controller';
import { PendaftaranService } from './services/pendaftaran.service';
import {
  CreatePendaftaranDto,
  CreatePendaftaranPenjaminItemDto,
} from './dto/create-pendaftaran.dto';
import { MutasiPendaftaranDto } from './dto/mutasi-pendaftaran.dto';
import { UpdatePenjaminPendaftaranDto } from './dto/update-penjamin-pendaftaran.dto';
import { BatalRanapDto } from './dto/update-status-pendaftaran.dto';

describe('Swagger OpenAPI & Validasi DTO Transaksi Pendaftaran', () => {
  it('menghasilkan dokumen Swagger OpenAPI JSON lengkap untuk seluruh endpoint & schema Transaksi Pendaftaran', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PendaftaranController],
      providers: [{ provide: PendaftaranService, useValue: {} }],
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

    expect(document.paths['/transaksi/pendaftaran']).toBeDefined();
    expect(document.paths['/transaksi/pendaftaran/jadwal-dokter']).toBeDefined();
    expect(document.paths['/transaksi/pendaftaran/{id}']).toBeDefined();
    expect(
      document.paths['/transaksi/pendaftaran/{id}/history-unit'],
    ).toBeDefined();
    expect(document.paths['/transaksi/pendaftaran/{id}/mutasi']).toBeDefined();
    expect(
      document.paths['/transaksi/pendaftaran/{id}/penjamin'],
    ).toBeDefined();
    expect(
      document.paths['/transaksi/pendaftaran/{id}/batal-ranap'],
    ).toBeDefined();
    expect(document.paths['/transaksi/pendaftaran/{id}/selesai']).toBeDefined();
    expect(document.paths['/transaksi/pendaftaran/{id}/batal']).toBeDefined();

    const schemas = document.components?.schemas ?? {};
    expect(schemas.CreatePendaftaranDto).toBeDefined();
    expect(schemas.CreatePendaftaranPenjaminItemDto).toBeDefined();
    expect(schemas.UpdatePenjaminPendaftaranDto).toBeDefined();
    expect(schemas.CreatePasienDto).toBeDefined();
    expect(schemas.MutasiPendaftaranDto).toBeDefined();
    expect(schemas.BatalRanapDto).toBeDefined();
    expect(schemas.SelesaiPendaftaranDto).toBeDefined();
    expect(schemas.BatalPendaftaranDto).toBeDefined();

    await app.close();
  });

  it('memvalidasi dan menormalisasi CreatePendaftaranDto (pasienBaru nested), MutasiPendaftaranDto, dan BatalRanapDto', async () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      transform: true,
    });

    const createDto = (await pipe.transform(
      {
        unitId: '1',
        jadwalDokterId: '10',
        jenisPenjamin: JenisPenjamin.UMUM,
        pasienId: '',
        pasienBaru: {
          penduduk: {
            nik: '  ',
            namaLengkap: ' Siti Nurhaliza ',
            jenisKelamin: JenisKelamin.PEREMPUAN,
          },
        },
        keluhanUtama: '  Demam tinggi  ',
      },
      { type: 'body', metatype: CreatePendaftaranDto },
    )) as CreatePendaftaranDto;

    expect(createDto.unitId).toBe(1);
    expect(createDto.jadwalDokterId).toBe(10);
    expect(createDto.pasienId).toBeUndefined();
    expect(createDto.pasienBaru?.penduduk?.nik).toBeUndefined();
    expect(createDto.pasienBaru?.penduduk?.namaLengkap).toBe('Siti Nurhaliza');
    expect(createDto.keluhanUtama).toBe('Demam tinggi');

    const mutasiDto = (await pipe.transform(
      {
        unitTujuanId: '3',
        bedTujuanId: '201',
        dokterTujuanId: '101',
        alasan: '  Perlu rawat inap  ',
      },
      { type: 'body', metatype: MutasiPendaftaranDto },
    )) as MutasiPendaftaranDto;

    expect(mutasiDto.unitTujuanId).toBe(3);
    expect(mutasiDto.bedTujuanId).toBe(201);
    expect(mutasiDto.dokterTujuanId).toBe(101);
    expect(mutasiDto.alasan).toBe('Perlu rawat inap');

    await expect(
      pipe.transform(
        { alasan: '   ' },
        { type: 'body', metatype: BatalRanapDto },
      ),
    ).rejects.toThrow();

    const multiPenjaminDto = (await pipe.transform(
      {
        unitId: '1',
        jadwalDokterId: '10',
        pasienId: '50',
        penjaminList: [
          {
            urutan: '1',
            isUtama: true,
            jenisPenjamin: JenisPenjamin.BPJS,
            penjaminId: '2',
            noKartu: ' 0001234567890 ',
            noSep: ' SEP-001 ',
          },
          {
            urutan: '2',
            isUtama: false,
            jenisPenjamin: JenisPenjamin.ASURANSI_SWASTA,
            penjaminId: '3',
            noKartu: ' POL-9988 ',
            keterangan: ' COB selisih kelas ',
          },
        ],
      },
      { type: 'body', metatype: CreatePendaftaranDto },
    )) as CreatePendaftaranDto;

    expect(multiPenjaminDto.penjaminList).toHaveLength(2);
    expect(multiPenjaminDto.penjaminList?.[0]).toBeInstanceOf(
      CreatePendaftaranPenjaminItemDto,
    );
    expect(multiPenjaminDto.penjaminList?.[0].urutan).toBe(1);
    expect(multiPenjaminDto.penjaminList?.[0].penjaminId).toBe(2);
    expect(multiPenjaminDto.penjaminList?.[0].noKartu).toBe('0001234567890');
    expect(multiPenjaminDto.penjaminList?.[1].keterangan).toBe(
      'COB selisih kelas',
    );

    const updatePenjaminDto = (await pipe.transform(
      {
        penjaminList: [
          {
            jenisPenjamin: JenisPenjamin.UMUM,
          },
        ],
      },
      { type: 'body', metatype: UpdatePenjaminPendaftaranDto },
    )) as UpdatePenjaminPendaftaranDto;
    expect(updatePenjaminDto.penjaminList).toHaveLength(1);

    await expect(
      pipe.transform(
        { penjaminList: [] },
        { type: 'body', metatype: UpdatePenjaminPendaftaranDto },
      ),
    ).rejects.toThrow();
  });
});

