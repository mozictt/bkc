import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../entities/tenant.entity';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { UpdateTenantSettingsDto } from './dto/tenant-settings.dto';
import {
  formatNoRmFromConfig,
  NormalizedTenantSettings,
  normalizeTenantSettings,
  validateTenantNoRmSetting,
} from './tenant-settings.config';

export interface TenantSettingsResponsePayload {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  settings: NormalizedTenantSettings;
  previewNoRm: string;
}

@Injectable()
export class TenantSettingsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly tenantContext: TenantContextService,
  ) {}

  async getTenantSettings(
    tenantId?: string,
  ): Promise<TenantSettingsResponsePayload> {
    const targetTenantId = tenantId || this.tenantContext.getTenantId();
    if (!targetTenantId) {
      throw new BadRequestException('Konteks tenant aktif tidak ditemukan.');
    }

    const tenant = await this.tenantRepo.findOne({
      where: { id: targetTenantId },
      select: ['id', 'name', 'slug', 'settings'],
    });
    if (!tenant) {
      throw new NotFoundException(
        `Tenant dengan ID ${targetTenantId} tidak ditemukan.`,
      );
    }

    const normalized = normalizeTenantSettings(tenant.settings);
    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      settings: normalized,
      previewNoRm: formatNoRmFromConfig(1, normalized.noRm),
    };
  }

  async updateCurrentTenantSettings(
    dto: UpdateTenantSettingsDto,
  ): Promise<TenantSettingsResponsePayload> {
    const targetTenantId = this.tenantContext.getTenantId();
    if (!targetTenantId) {
      throw new BadRequestException('Konteks tenant aktif tidak ditemukan.');
    }
    return this.updateSettings(
      targetTenantId,
      dto as unknown as Record<string, unknown>,
    );
  }

  async updateSettings(
    id: string,
    payload: UpdateTenantSettingsDto | Record<string, unknown>,
  ): Promise<TenantSettingsResponsePayload> {
    const tenant = await this.tenantRepo.findOne({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant dengan ID ${id} tidak ditemukan.`);
    }

    const existingRaw = (tenant.settings || {}) as Record<string, unknown>;
    const currentNormalized = normalizeTenantSettings(existingRaw);
    const incoming = (payload || {}) as Record<string, unknown>;

    const incomingNoRm =
      incoming.noRm &&
      typeof incoming.noRm === 'object' &&
      !Array.isArray(incoming.noRm)
        ? (incoming.noRm as Record<string, unknown>)
        : {};
    const incomingPendaftaran =
      incoming.pendaftaran &&
      typeof incoming.pendaftaran === 'object' &&
      !Array.isArray(incoming.pendaftaran)
        ? (incoming.pendaftaran as Record<string, unknown>)
        : {};

    const mergedRaw: Record<string, unknown> = {
      ...existingRaw,
      ...incoming,
      noRm: {
        ...currentNormalized.noRm,
        ...incomingNoRm,
      },
      pendaftaran: {
        ...currentNormalized.pendaftaran,
        ...incomingPendaftaran,
      },
    };

    const normalized = normalizeTenantSettings(mergedRaw);
    validateTenantNoRmSetting(normalized.noRm);

    if (
      normalized.noRm.mode === 'PRESET' &&
      (normalized.noRm.presetKode === 'PLAIN_8' ||
        normalized.noRm.presetKode === 'DASH_6')
    ) {
      normalized.noRmFormat = normalized.noRm.presetKode;
    } else if ('noRmFormat' in normalized) {
      delete normalized.noRmFormat;
    }

    tenant.settings = normalized;
    const saved = await this.tenantRepo.save(tenant);
    const finalNormalized = normalizeTenantSettings(saved.settings);

    return {
      tenantId: saved.id,
      tenantName: saved.name,
      tenantSlug: saved.slug,
      settings: finalNormalized,
      previewNoRm: formatNoRmFromConfig(1, finalNormalized.noRm),
    };
  }
}

