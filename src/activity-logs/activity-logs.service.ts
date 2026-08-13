import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ActivityLog } from './entities/activity-log.entity';
import { QueryActivityLogDto } from './dto/query-activity-log.dto';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { TenantContextService } from '../common/tenant/tenant-context.service';

import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class ActivityLogsService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepo: Repository<ActivityLog>,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * Cron Job harian untuk membersihkan log aktivitas yang lebih tua dari 6 bulan (180 hari).
   * Otomatis berjalan setiap hari pada pukul 00:00 (Tengah malam).
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleCronCleanupOldLogs() {
    await this.cleanOldLogs(6);
  }

  /**
   * Menghapus log yang usianya lebih tua dari X bulan (Default: 6 bulan).
   */
  async cleanOldLogs(months: number = 6): Promise<{ deletedCount: number }> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);

      const result = await this.activityLogRepo
        .createQueryBuilder()
        .delete()
        .from(ActivityLog)
        .where('createdAt < :cutoffDate', { cutoffDate: cutoffDate.toISOString() })
        .execute();

      const deletedCount = result.affected || 0;
      if (deletedCount > 0) {
        console.log(
          `[ActivityLogsCron] Sukses menghapus ${deletedCount} baris log aktivitas yang berusia lebih dari ${months} bulan.`,
        );
      }

      return { deletedCount };
    } catch (error) {
      console.error('[ActivityLogsCron] Gagal membersihkan log lama:', error);
      return { deletedCount: 0 };
    }
  }

  /**
   * Menyimpan log aktivitas secara tertutup/asinkron.
   */
  async createLog(dto: CreateActivityLogDto): Promise<ActivityLog> {
    const tenantId = dto.tenantId || this.tenantContext.getTenantId() || null;
    const log = this.activityLogRepo.create({
      ...dto,
      tenantId: tenantId,
    });
    return await this.activityLogRepo.save(log);
  }

  /**
   * Menarik daftar log aktivitas berdasarkan rentang tanggal, user, dan modul.
   * Mencegah masalah N+1 query dengan eager/left join user dan seleksi kolom yang efisien.
   */
  async findAll(query: QueryActivityLogDto) {
    const tenantId = this.tenantContext.getTenantId();
    const {
      startDate,
      endDate,
      userId,
      module: moduleName,
      action,
      search,
      page = 1,
      limit = 10,
    } = query;

    const qb = this.activityLogRepo
      .createQueryBuilder('log')
      .leftJoin('log.user', 'user')
      .addSelect(['user.id', 'user.username'])
      .orderBy('log.createdAt', 'DESC');

    // Filter Tenant (Multitenancy)
    if (tenantId) {
      qb.andWhere('log.tenantId = :tenantId', { tenantId });
    }

    // Filter Rentang Tanggal (startDate & endDate)
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      qb.andWhere('log.createdAt >= :startDate', { startDate: start.toISOString() });
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      qb.andWhere('log.createdAt <= :endDate', { endDate: end.toISOString() });
    }

    // Filter berdasarkan User ID
    if (userId) {
      qb.andWhere('log.userId = :userId', { userId });
    }

    // Filter berdasarkan Modul
    if (moduleName) {
      qb.andWhere('LOWER(log.module) = LOWER(:moduleName)', { moduleName });
    }

    // Filter berdasarkan Aksi (CREATE, UPDATE, DELETE, LOGIN, dll.)
    if (action) {
      qb.andWhere('LOWER(log.action) = LOWER(:action)', { action });
    }

    // Pencarian Bebas (Search)
    if (search) {
      qb.andWhere(
        '(LOWER(log.username) LIKE LOWER(:search) OR LOWER(log.description) LIKE LOWER(:search) OR LOWER(log.path) LIKE LOWER(:search))',
        { search: `%${search}%` },
      );
    }

    // Pagination
    const skip = (page - 1) * limit;
    qb.skip(skip).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        totalData: total,
        currentPage: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Mengambil daftar modul unik yang tersedia untuk opsi dropdown filter di UI.
   */
  async getAvailableModules(): Promise<string[]> {
    const tenantId = this.tenantContext.getTenantId();
    const qb = this.activityLogRepo
      .createQueryBuilder('log')
      .select('DISTINCT log.module', 'module')
      .where('log.module IS NOT NULL');

    if (tenantId) {
      qb.andWhere('log.tenantId = :tenantId', { tenantId });
    }

    const results = await qb.getRawMany();
    return results.map((r) => r.module).filter(Boolean);
  }
}
