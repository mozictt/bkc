import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  ConflictException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { RequirePermission } from '../../permissions/decorators/require-permission.decorator';
import { BudgetService } from '../services/budget.service';
import { CreateBudgetDto } from '../dto/create-budget.dto';
import { GenerateBudgetDto } from '../dto/generate-budget.dto';
import { ReportQueryDto } from '../dto/report-query.dto';

@ApiTags('Rumah Tangga - Anggaran')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('rumah-tangga/budgets')
export class BudgetController {
  constructor(private readonly budgetService: BudgetService) {}

  @Get()
  @RequirePermission('rumah-tangga.anggaran', 'view')
  @ApiOperation({ summary: 'List anggaran per bulan dengan realisasi' })
  async findByPeriod(@Query() query: ReportQueryDto) {
    const now = new Date();
    const year = query.year || now.getFullYear();
    const month = query.month || now.getMonth() + 1;
    return this.budgetService.findByPeriod(year, month);
  }

  @Post()
  @RequirePermission('rumah-tangga.anggaran', 'create')
  @ApiOperation({ summary: 'Buat/update anggaran per kategori per bulan (upsert)' })
  async upsert(@Body() dto: CreateBudgetDto) {
    return this.budgetService.upsert(dto);
  }

  @Post('generate')
  @RequirePermission('rumah-tangga.anggaran', 'create')
  @ApiOperation({
    summary: 'Generate anggaran bulan ini dari data bulan sebelumnya',
    description:
      'Menyalin seluruh item anggaran dari bulan sebelumnya ke periode target. ' +
      'Item yang sudah ada di periode target akan dilewati kecuali overwrite=true.',
  })
  @ApiBody({ type: GenerateBudgetDto })
  async generateFromPrevious(@Body() dto: GenerateBudgetDto) {
    const result = await this.budgetService.generateFromPrevious(
      dto.targetYear,
      dto.targetMonth,
      dto.overwrite ?? false,
    );

    if (result.generated === 0 && result.skipped === 0) {
      throw new ConflictException(
        `Tidak ada data anggaran di bulan ${result.sourceMonth}/${result.sourceYear} untuk dijadikan referensi.`,
      );
    }

    return {
      message: `Berhasil generate ${result.generated} anggaran dari ${result.sourceMonth}/${result.sourceYear}. Dilewati: ${result.skipped}.`,
      generated: result.generated,
      skipped: result.skipped,
      sourceMonth: result.sourceMonth,
      sourceYear: result.sourceYear,
    };
  }

  @Delete(':id')
  @RequirePermission('rumah-tangga.anggaran', 'delete')
  @ApiOperation({ summary: 'Soft delete anggaran' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.budgetService.remove(id);
    return { message: 'Anggaran berhasil dihapus' };
  }
}
