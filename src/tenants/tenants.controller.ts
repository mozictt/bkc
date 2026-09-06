import { Controller, Post, Get, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { CloneTenantConfigDto } from './dto/clone-tenant-config.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiBody } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';
import { MasterTenantGuard } from '../common/guards/master-tenant.guard';

@ApiTags('Tenants')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Registrasi tenant/klinik baru' })
  async registerTenant(@Body() dto: RegisterTenantDto) {
    return this.tenantsService.registerTenant(dto);
  }

  @Get()
  @UseGuards(MasterTenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mendapatkan semua daftar tenant (Khusus Master Tenant)' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async findAll(
    @Query('search') search?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.tenantsService.findAll(search, +page, +limit);
  }

  @Get(':id')
  @UseGuards(MasterTenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mendapatkan detail tenant berdasarkan ID' })
  async findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(MasterTenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Memperbarui detail, status, atau masa kedaluwarsa (expiredAt) tenant (Khusus Master Tenant)' })
  @ApiBody({ type: UpdateTenantDto })
  async updateTenant(
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    return this.tenantsService.updateTenant(id, dto);
  }

  @Patch(':id/settings')
  @UseGuards(MasterTenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Memperbarui konfigurasi/setting tenant anak (Khusus Master Tenant)' })
  async updateSettings(
    @Param('id') id: string,
    @Body() settings: Record<string, any>,
  ) {
    return this.tenantsService.updateSettings(id, settings);
  }

  @Patch(':id/toggle-master')
  @UseGuards(MasterTenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mengubah status Master Tenant (Toggle isMaster)' })
  async toggleMaster(@Param('id') id: string) {
    return this.tenantsService.toggleMaster(id);
  }

  @Post('clone-config')
  @UseGuards(MasterTenantGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Menduplikasi konfigurasi Menu, Role, dan Permission ke Tenant Tujuan (Khusus Master Tenant)' })
  async cloneTenantConfig(@Body() dto: CloneTenantConfigDto) {
    return this.tenantsService.cloneTenantConfig(dto);
  }
}
