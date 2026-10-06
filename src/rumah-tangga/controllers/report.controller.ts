import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { RequirePermission } from '../../permissions/decorators/require-permission.decorator';
import { ReportService } from '../services/report.service';
import { ReportQueryDto } from '../dto/report-query.dto';

@ApiTags('Rumah Tangga - Laporan')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('rumah-tangga/reports')
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Get('monthly')
  @RequirePermission('rumah-tangga.laporan', 'view')
  @ApiOperation({ summary: 'Laporan bulanan: income vs expense per bulan dalam setahun' })
  @ApiQuery({ name: 'year', required: false, example: 2026 })
  async getMonthlyReport(@Query('year') year?: number) {
    const reportYear = year || new Date().getFullYear();
    return this.reportService.getMonthlyReport(reportYear);
  }

  @Get('trend')
  @RequirePermission('rumah-tangga.laporan', 'view')
  @ApiOperation({ summary: 'Tren pengeluaran N bulan terakhir' })
  @ApiQuery({ name: 'months', required: false, example: 6, description: 'Jumlah bulan ke belakang' })
  async getTrend(@Query('months') months?: number) {
    return this.reportService.getTrend(months || 6);
  }

  @Get('by-category')
  @RequirePermission('rumah-tangga.laporan', 'view')
  @ApiOperation({ summary: 'Laporan pengeluaran per kategori dengan persentase' })
  async getCategoryReport(@Query() query: ReportQueryDto) {
    const year = query.year || new Date().getFullYear();
    return this.reportService.getCategoryReport(year, query.month);
  }

  @Get('recurring')
  @RequirePermission('rumah-tangga.laporan', 'view')
  @ApiOperation({ summary: 'Laporan pengeluaran rutin (tagihan tetap) per bulan' })
  async getRecurringReport(@Query() query: ReportQueryDto) {
    const year = query.year || new Date().getFullYear();
    return this.reportService.getRecurringReport(year, query.month);
  }
}
