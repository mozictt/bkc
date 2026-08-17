// src/company-profile/company-profile.service.ts
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as fs from 'fs';
import * as path from 'path';

import { CompanyProfile } from './entities/company-profile.entity';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { BaseTenantService } from '../common/tenant/base-tenant.service';
import { CreateCompanyProfileDto } from './dto/create-company-profile.dto';
import { UpdateCompanyProfileDto } from './dto/update-company-profile.dto';
import { UploadStorageHelper } from '@common/utils/upload-storage.util';

@Injectable()
export class CompanyProfileService extends BaseTenantService<CompanyProfile> {
  // TTL 3 Jam = 10800 detik
  private readonly CACHE_TTL_SECONDS = 3 * 3600;

  constructor(
    @InjectRepository(CompanyProfile)
    private readonly companyProfileRepo: Repository<CompanyProfile>,
    tenantService: TenantContextService,
    @InjectRedis() private readonly redis: Redis,
  ) {
    super(companyProfileRepo, tenantService, 'company_profile');
  }

  /**
   * Menghasilkan path folder penyimpanan logo berdasarkan slug tenant via UploadStorageHelper.
   */
  getLogoUploadPath(slug?: string): { relativeFolder: string; absoluteFolder: string } {
    return UploadStorageHelper.getUploadPath(slug, 'company-profile');
  }

  // ─── Helper: Generate Key Cache Redis Berdasarkan User Login ─────────────

  private getCacheKey(explicitUserId?: number | string | null): string {
    const userId = explicitUserId || this.tenantService.getUserId();
    if (userId) {
      return `company_profile:user:${userId}`;
    }
    const tenantId = this.tenantService.getTenantId();
    return `company_profile:tenant:${tenantId || 'global'}`;
  }

  // ─── Helper: Invalidate Semua Cache Company Profile Saat Ada Update ──────

  private async invalidateCache(): Promise<void> {
    try {
      const keys = await this.redis.keys('company_profile:*');
      if (keys && keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (err) {
      console.error('[CompanyProfileService] Redis error saat invalidate cache:', err);
    }
  }

  // ─── Stream / Serves file logo perusahaan ────────────────────────────────

  streamLogo(rawPath: string, res: any) {
    const filePath = UploadStorageHelper.resolveFileForStreaming(rawPath, 'company-logo');

    if (!filePath) {
      throw new NotFoundException('File logo tidak ditemukan');
    }

    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream';
    if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.svg') contentType = 'image/svg+xml';

    const stat = fs.statSync(filePath);
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    });

    fs.createReadStream(filePath).pipe(res);
  }

  // ─── Ambil profil perusahaan (Caching Redis per User Login TTL 3 jam) ────

  async getProfile(explicitUserId?: number | string): Promise<CompanyProfile> {
    const cacheKey = this.getCacheKey(explicitUserId);

    // 1. Cek di Redis Cache
    try {
      const cachedData = await this.redis.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
    } catch (err) {
      console.error('[CompanyProfileService] Redis error saat get cache:', err);
    }

    // 2. Jika Cache Miss, Query Database
    const tenantId = this.tenantService.getTenantId();
    const role = this.tenantService.getRole();

    let profile: CompanyProfile | null;  
    if (role === 'Super Admin') { 
      profile = await this.companyProfileRepo.findOne({
        where: { deletedAt: null as any },
        relations: [
          'kelurahan',
          'kelurahan.kecamatan',
          'kelurahan.kecamatan.kabupaten',
          'kelurahan.kecamatan.kabupaten.provinsi',
        ],
      });
    } else { 
      if (!tenantId) {
        throw new NotFoundException('Tenant tidak ditemukan');
      } 
      profile = await this.companyProfileRepo.findOne({
        where: { tenantId, deletedAt: null as any },
        relations: [
          'kelurahan',
          'kelurahan.kecamatan',
          'kelurahan.kecamatan.kabupaten',
          'kelurahan.kecamatan.kabupaten.provinsi',
        ],
      });  
    }

    if (!profile) {
      throw new NotFoundException(
        'Profil perusahaan belum dikonfigurasi. Silakan buat profil terlebih dahulu.',
      );
    }

    // 3. Simpan ke Redis dengan TTL 3 jam (10.800s)
    try {
      await this.redis.set(
        cacheKey,
        JSON.stringify(profile),
        'EX',
        this.CACHE_TTL_SECONDS,
      );
    } catch (err) {
      console.error('[CompanyProfileService] Redis error saat set cache:', err);
    }

    return profile;
  }

  // ─── Buat profil baru ────────────────────────────────────────────────────

  async createProfile(
    dto: CreateCompanyProfileDto,
    logoFile?: Express.Multer.File,
  ): Promise<CompanyProfile> {
    const tenantId = this.tenantService.getTenantId();
    const role = this.tenantService.getRole();

    if (role !== 'Super Admin') {
      if (!tenantId) throw new NotFoundException('Tenant tidak ditemukan');

      const existing = await this.companyProfileRepo.findOne({
        where: { tenantId },
        withDeleted: false,
      });

      if (existing) {
        throw new ConflictException(
          'Profil perusahaan sudah ada. Gunakan endpoint update untuk mengubahnya.',
        );
      }
    }

    const profile = this.companyProfileRepo.create({
      ...dto,
      tenantId: role !== 'Super Admin' ? tenantId : undefined,
      ...this.resolveLogoFields(logoFile),
    });

    await this.companyProfileRepo.save(profile);
    await this.invalidateCache();
    return this.getProfile();
  }

  // ─── Update profil berdasarkan ID ─────────────────────────────────────────

  async updateProfile(
    id: number,
    dto: UpdateCompanyProfileDto,
    logoFile?: Express.Multer.File,
  ): Promise<CompanyProfile> {
    const existing = await this.findOneById(id);

    if (logoFile && (existing.logoFilename || existing.logoPath)) {
      this.deleteOldLogo(existing.logoFilename, existing.logoPath);
    }

    await this.companyProfileRepo.save({
      ...existing,
      ...dto,
      ...this.resolveLogoFields(logoFile),
    });

    await this.invalidateCache();
    return this.getProfile();
  }

  // ─── Soft delete profil berdasarkan ID ────────────────────────────────────

  async removeProfile(id: number): Promise<{ message: string }> {
    await this.findOneById(id);
    await this.companyProfileRepo.softDelete(id);
    await this.invalidateCache();

    return { message: 'Profil perusahaan berhasil dihapus' };
  }

  // ─── Upload / ganti logo ─────────────────────────────────────────────────

  async uploadLogo(
    id: number,
    logoFile: Express.Multer.File,
  ): Promise<CompanyProfile> {
    if (!logoFile) {
      throw new BadRequestException('File logo wajib diunggah');
    }

    const existing = await this.findOneById(id);

    if (existing.logoFilename || existing.logoPath) {
      this.deleteOldLogo(existing.logoFilename, existing.logoPath);
    }

    const updated = await this.companyProfileRepo.save({
      ...existing,
      ...this.resolveLogoFields(logoFile),
    });

    await this.invalidateCache();
    return updated;
  }

  // ─── Hapus logo saja (tanpa hapus profil) ────────────────────────────────

  async removeLogo(id: number): Promise<CompanyProfile> {
    const existing = await this.findOneById(id);

    if (!existing.logoFilename && !existing.logoPath) {
      throw new NotFoundException('Profil perusahaan ini belum memiliki logo');
    }

    this.deleteOldLogo(existing.logoFilename, existing.logoPath);

    const updated = await this.companyProfileRepo.save({
      ...existing,
      logoPath: null,
      logoFilename: null,
    });

    await this.invalidateCache();
    return updated;
  }

  // ─── Helper: Resolve field logo dari file upload ─────────────────────────

  private resolveLogoFields(
    file?: Express.Multer.File,
  ): Partial<CompanyProfile> {
    if (!file) return {};

    const slug = this.tenantService.getSlug() || 'default';
    const { relativeFolder, absoluteFolder } = this.getLogoUploadPath(slug);

    UploadStorageHelper.ensureDirectoryExists(absoluteFolder);

    const targetFilePath = path.join(absoluteFolder, file.filename);

    const sourcePath = file.path
      ? (path.isAbsolute(file.path) ? file.path : path.resolve(process.cwd(), file.path))
      : path.join(process.cwd(), 'storage/uploads/.tmp', file.filename);

    if (fs.existsSync(sourcePath)) {
      UploadStorageHelper.moveFile(sourcePath, targetFilePath);
    }

    const storedFileName = path.join(relativeFolder, file.filename).replace(/\\/g, '/');

    return {
      logoPath: `/company-profile/logo/${storedFileName}`,
      logoFilename: storedFileName,
    };
  }

  // ─── Helper: Hapus file logo lama dari disk ──────────────────────────────

  private deleteOldLogo(
    logoFilename?: string | null,
    oldLogoPath?: string | null,
  ): void {
    const filename =
      logoFilename || (oldLogoPath ? oldLogoPath.replace('/company-profile/logo/', '') : null);
    if (!filename) return;

    UploadStorageHelper.removeFile(filename, 'company-logo');
  }
}

