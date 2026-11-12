import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { PermissionGuard } from '@src/permissions/guards/permission.guard';
import { MasterTenantGuard } from '@common/guards/master-tenant.guard';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { Tenant } from '@entities/tenant.entity';
import { TenantSettingsController } from './tenant-settings.controller';
import { TenantSettingsService } from './tenant-settings.service';
import { UpdateTenantSettingsDto } from './dto/tenant-settings.dto';
import {
  formatNoRmFromConfig,
  normalizeTenantSettings,
} from './tenant-settings.config';

describe('Tenants Settings (Unit, Validation & Swagger OpenAPI)', () => {
  const tenantA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const tenantB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  it('menghasilkan preview No. RM dan normalisasi setting terpisah per tenant serta mempertahankan key JSONB lain', async () => {
    const mockTenants = new Map<string, Tenant>([
      [
        tenantA,
        {
          id: tenantA,
          name: 'RS Utama',
          slug: 'rs-utama',
          settings: { timezone: 'Asia/Jakarta', frontendUrl: 'http://localhost:3000' },
        } as unknown as Tenant,
      ],
      [
        tenantB,
        {
          id: tenantB,
          name: 'Klinik Rajal',
          slug: 'klinik-rajal',
          settings: {},
        } as unknown as Tenant,
      ],
    ]);

    const repo = {
      findOne: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(mockTenants.get(where.id) ?? null),
      ),
      save: jest.fn((entity: Tenant) => {
        mockTenants.set(entity.id, entity);
        return Promise.resolve(entity);
      }),
    };
    const tenantContext = {
      getTenantId: jest.fn(() => tenantB),
    };

    const service = new TenantSettingsService(
      repo as unknown as Repository<Tenant>,
      tenantContext as unknown as TenantContextService,
    );

    const savedA = await service.updateSettings(tenantA, {
      noRm: {
        mode: 'PRESET',
        presetKode: 'PLAIN_8',
      },
    });
    expect(savedA.previewNoRm).toBe('00000001');
    expect(savedA.settings.timezone).toBe('Asia/Jakarta');
    expect(savedA.settings.pendaftaran.judulHalaman).toBe(
      'Pendaftaran Kunjungan Pasien',
    );

    const savedB = await service.updateCurrentTenantSettings({
      noRm: {
        mode: 'PRESET',
        presetKode: 'PLAIN_4',
      },
      pendaftaran: {
        judulHalaman: 'Pendaftaran Kunjungan Pasien Rajal',
      },
    });
    expect(savedB.tenantId).toBe(tenantB);
    expect(savedB.previewNoRm).toBe('0001');
    expect(savedB.settings.noRm.jumlahDigit).toBe(4);
    expect(savedB.settings.pendaftaran.judulHalaman).toBe(
      'Pendaftaran Kunjungan Pasien Rajal',
    );

    await expect(
      service.updateSettings(tenantB, {
        noRm: {
          mode: 'CUSTOM',
          presetKode: 'CUSTOM',
          jumlahDigit: 4,
          panjangBlok: 6,
        },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('menghormati fallback legacy noRmFormat & memformat custom pattern dengan prefix/suffix/blok', () => {
    const legacy = normalizeTenantSettings({ noRmFormat: 'DASH_6' });
    expect(legacy.noRm.presetKode).toBe('DASH_6');
    expect(formatNoRmFromConfig(12, legacy.noRm)).toBe('00-00-12');

    expect(
      formatNoRmFromConfig(7, {
        jumlahDigit: 4,
        prefix: 'RJ-',
        suffix: '-A',
      }),
    ).toBe('RJ-0007-A');
  });

  it('menghasilkan Swagger OpenAPI JSON dan memvalidasi DTO UpdateTenantSettingsDto', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TenantSettingsController],
      providers: [{ provide: TenantSettingsService, useValue: {} }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(MasterTenantGuard)
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

    expect(document.paths['/tenants/settings/current']).toBeDefined();
    expect(document.paths['/tenants/{id}/settings']).toBeDefined();
    const schemas = document.components?.schemas ?? {};
    expect(schemas.UpdateTenantSettingsDto).toBeDefined();
    expect(schemas.UpdateTenantNoRmSettingDto).toBeDefined();
    expect(schemas.UpdateTenantPendaftaranSettingDto).toBeDefined();

    await app.close();

    const pipe = new ValidationPipe({
      whitelist: true,
      transform: true,
    });
    const parsed = (await pipe.transform(
      {
        noRm: {
          mode: 'CUSTOM',
          presetKode: 'CUSTOM',
          jumlahDigit: '4',
          prefix: '   ',
          panjangBlok: '0',
        },
        pendaftaran: {
          judulHalaman: '  Pendaftaran Kunjungan Pasien Rajal  ',
        },
      },
      { type: 'body', metatype: UpdateTenantSettingsDto },
    )) as UpdateTenantSettingsDto;

    expect(parsed.noRm?.jumlahDigit).toBe(4);
    expect(parsed.noRm?.prefix).toBeNull();
    expect(parsed.noRm?.panjangBlok).toBeNull();
    expect(parsed.pendaftaran?.judulHalaman).toBe(
      'Pendaftaran Kunjungan Pasien Rajal',
    );
  });
});
