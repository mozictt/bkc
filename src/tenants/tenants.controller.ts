import { Controller, Post, Body } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { RegisterTenantDto } from './dto/register-tenant.dto';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/public.decorator';

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
}
