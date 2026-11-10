import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PekerjaanService } from '../services/pekerjaan.service';
import { CreatePekerjaanDto } from '../dto/create-pekerjaan.dto';
import { UpdatePekerjaanDto } from '../dto/update-pekerjaan.dto';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { PermissionGuard } from '@src/permissions/guards/permission.guard';
import { RequirePermission } from '@src/permissions/decorators/require-permission.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Master - Pekerjaan')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('master/pekerjaan')
export class PekerjaanController {
  constructor(private readonly pekerjaanService: PekerjaanService) {}

  @Get()
  @RequirePermission('Pekerjaan', 'view')
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search = '',
    @Query('sortBy') sortBy = 'id',
    @Query('sortType') sortType = 'desc',
  ) {
    return this.pekerjaanService.findAll(
      +page,
      +limit,
      search,
      sortBy,
      sortType,
    );
  }

  @Get(':id')
  @RequirePermission('Pekerjaan', 'view')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pekerjaanService.findOne(id);
  }

  @Post()
  @RequirePermission('Pekerjaan', 'create')
  async create(@Body() data: CreatePekerjaanDto) {
    return this.pekerjaanService.create(data);
  }

  @Put(':id')
  @RequirePermission('Pekerjaan', 'update')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdatePekerjaanDto,
  ) {
    return this.pekerjaanService.update(id, data);
  }

  @Delete(':id')
  @RequirePermission('Pekerjaan', 'delete')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.pekerjaanService.remove(id);
    return { message: 'Pekerjaan berhasil dihapus' };
  }
}

