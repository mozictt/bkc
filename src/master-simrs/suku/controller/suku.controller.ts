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
import { SukuService } from '../services/suku.service';
import { CreateSukuDto } from '../dto/create-suku.dto';
import { UpdateSukuDto } from '../dto/update-suku.dto';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { PermissionGuard } from '@src/permissions/guards/permission.guard';
import { RequirePermission } from '@src/permissions/decorators/require-permission.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Master - Suku')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('master/suku')
export class SukuController {
  constructor(private readonly sukuService: SukuService) {}

  @Get()
  @RequirePermission('Suku', 'view')
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search = '',
    @Query('sortBy') sortBy = 'id',
    @Query('sortType') sortType = 'desc',
  ) {
    return this.sukuService.findAll(+page, +limit, search, sortBy, sortType);
  }

  @Get(':id')
  @RequirePermission('Suku', 'view')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.sukuService.findOne(id);
  }

  @Post()
  @RequirePermission('Suku', 'create')
  async create(@Body() data: CreateSukuDto) {
    return this.sukuService.create(data);
  }

  @Put(':id')
  @RequirePermission('Suku', 'update')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateSukuDto,
  ) {
    return this.sukuService.update(id, data);
  }

  @Delete(':id')
  @RequirePermission('Suku', 'delete')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.sukuService.remove(id);
    return { message: 'Suku berhasil dihapus' };
  }
}

