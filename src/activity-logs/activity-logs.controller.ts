import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { ActivityLogsService } from './activity-logs.service';
import { QueryActivityLogDto } from './dto/query-activity-log.dto';
import { CreateActivityLogDto } from './dto/create-activity-log.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';

@ApiTags('Activity Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('activity-logs')
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  @RequirePermission('ActivityLog', 'view')
  @ApiOperation({
    summary: 'Menarik log aktivitas pengguna (dengan filter rentang tanggal, user, modul, & pagination)',
    description: 'Mengambil riwayat log aktivitas yang ter-scope pada tenant aktif. Mendukung filter tanggal awal (startDate), tanggal akhir (endDate), ID User, nama modul, aksi, serta pencarian kata kunci.',
  })
  @ApiResponse({ status: 200, description: 'Daftar log aktivitas berhasil diambil.' })
  findAll(@Query() query: QueryActivityLogDto) {
    return this.activityLogsService.findAll(query);
  }

  @Get('modules')
  @RequirePermission('ActivityLog', 'view')
  @ApiOperation({
    summary: 'Mendapatkan daftar modul unik yang tercatat di log aktivitas',
    description: 'Digunakan untuk mengisi opsi dropdown filter modul pada tampilan UI.',
  })
  @ApiResponse({ status: 200, description: 'Daftar modul unik berhasil diambil.' })
  getModules() {
    return this.activityLogsService.getAvailableModules();
  }

  @Post()
  @RequirePermission('ActivityLog', 'create')
  @ApiOperation({
    summary: 'Membuat log aktivitas secara manual',
    description: 'Digunakan untuk mencatat aktivitas khusus dari client/frontend.',
  })
  @ApiResponse({ status: 201, description: 'Log aktivitas berhasil dibuat.' })
  create(@Body() dto: CreateActivityLogDto) {
    return this.activityLogsService.createLog(dto);
  }

  @Delete('clean')
  @RequirePermission('ActivityLog', 'delete')
  @ApiOperation({
    summary: 'Pembersihan manual log aktivitas lama (opsional)',
    description: 'Menghapus data log yang berusia lebih dari X bulan (default 6 bulan).',
  })
  @ApiResponse({ status: 200, description: 'Proses pembersihan log selesai.' })
  cleanOldLogs(@Query('months') months?: number) {
    const monthsNum = months ? Number(months) : 6;
    return this.activityLogsService.cleanOldLogs(monthsNum);
  }
}
