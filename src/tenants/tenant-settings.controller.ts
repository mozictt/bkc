import { Body, Controller, Get, Param, Patch, Put, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MasterTenantGuard } from '../common/guards/master-tenant.guard';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { TenantSettingsService } from './tenant-settings.service';
import { UpdateTenantSettingsDto } from './dto/tenant-settings.dto';

@ApiTags('Tenants - Settings')
@ApiBearerAuth()
@Controller('tenants')
export class TenantSettingsController {
  constructor(private readonly tenantSettingsService: TenantSettingsService) {}

  @Get('settings/current')
  @ApiOperation({
    summary: 'Mengambil pengaturan kustomisasi tenant aktif saat ini',
    description:
      'Mengembalikan konfigurasi model No. RM serta kustomisasi label halaman pendaftaran untuk tenant aktif.',
  })
  @ApiResponse({
    status: 200,
    description: 'Pengaturan tenant aktif berhasil diambil.',
  })
  async getCurrentSettings() {
    return this.tenantSettingsService.getTenantSettings();
  }

  @Put('settings/current')
  @UseGuards(PermissionGuard)
  @RequirePermission('Pengaturan', 'update')
  @ApiOperation({
    summary: 'Memperbarui pengaturan kustomisasi tenant aktif saat ini',
  })
  @ApiBody({ type: UpdateTenantSettingsDto })
  @ApiResponse({
    status: 200,
    description: 'Pengaturan tenant berhasil disimpan.',
  })
  async updateCurrentSettings(@Body() dto: UpdateTenantSettingsDto) {
    return this.tenantSettingsService.updateCurrentTenantSettings(dto);
  }

  @Get(':id/settings')
  @UseGuards(MasterTenantGuard)
  @ApiParam({ name: 'id', description: 'UUID Tenant Target' })
  @ApiOperation({
    summary:
      'Mengambil pengaturan kustomisasi tenant tertentu (Khusus Master Tenant)',
  })
  async getSettingsByTenantId(@Param('id') id: string) {
    return this.tenantSettingsService.getTenantSettings(id);
  }

  @Patch(':id/settings')
  @UseGuards(MasterTenantGuard)
  @ApiParam({ name: 'id', description: 'UUID Tenant Target' })
  @ApiBody({ type: UpdateTenantSettingsDto })
  @ApiOperation({
    summary:
      'Memperbarui konfigurasi/setting tenant tertentu (Khusus Master Tenant)',
  })
  async updateSettingsByTenantId(
    @Param('id') id: string,
    @Body() dto: UpdateTenantSettingsDto,
  ) {
    return this.tenantSettingsService.updateSettings(id, dto);
  }
}

