import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { RequirePermission } from '../../permissions/decorators/require-permission.decorator';
import { DashboardService } from '../services/dashboard.service';
import { ReportQueryDto } from '../dto/report-query.dto';

@ApiTags('Rumah Tangga - Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('rumah-tangga/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @RequirePermission('rumah-tangga.dashboard', 'view')
  @ApiOperation({ summary: 'Ringkasan keuangan bulan ini vs bulan lalu' })
  async getSummary(@Query() query: ReportQueryDto) {
    const now = new Date();
    const year = query.year || now.getFullYear();
    const month = query.month || now.getMonth() + 1;
    return this.dashboardService.getSummary(year, month);
  }

  @Get('daily-chart')
  @RequirePermission('rumah-tangga.dashboard', 'view')
  @ApiOperation({ summary: 'Data pengeluaran harian (untuk area/line chart)' })
  async getDailyChart(@Query() query: ReportQueryDto) {
    const now = new Date();
    const year = query.year || now.getFullYear();
    const month = query.month || now.getMonth() + 1;
    return this.dashboardService.getDailyChart(year, month);
  }

  @Get('category-breakdown')
  @RequirePermission('rumah-tangga.dashboard', 'view')
  @ApiOperation({ summary: 'Distribusi pengeluaran per kategori (untuk pie chart)' })
  async getCategoryBreakdown(@Query() query: ReportQueryDto) {
    const now = new Date();
    const year = query.year || now.getFullYear();
    const month = query.month || now.getMonth() + 1;
    return this.dashboardService.getCategoryBreakdown(year, month);
  }

  @Get('member-breakdown')
  @RequirePermission('rumah-tangga.dashboard', 'view')
  @ApiOperation({ summary: 'Pengeluaran per anggota keluarga (untuk bar chart)' })
  async getMemberBreakdown(@Query() query: ReportQueryDto) {
    const now = new Date();
    const year = query.year || now.getFullYear();
    const month = query.month || now.getMonth() + 1;
    return this.dashboardService.getMemberBreakdown(year, month);
  }
}
