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
import { PendidikanService } from '../services/pendidikan.service';
import { CreatePendidikanDto } from '../dto/create-pendidikan.dto';
import { UpdatePendidikanDto } from '../dto/update-pendidikan.dto';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { PermissionGuard } from '@src/permissions/guards/permission.guard';
import { RequirePermission } from '@src/permissions/decorators/require-permission.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Master - Pendidikan')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('master/pendidikan')
export class PendidikanController {
  constructor(private readonly pendidikanService: PendidikanService) {}

  @Get()
  @RequirePermission('Pendidikan', 'view')
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search = '',
    @Query('sortBy') sortBy = 'id',
    @Query('sortType') sortType = 'desc',
  ) {
    return this.pendidikanService.findAll(
      +page,
      +limit,
      search,
      sortBy,
      sortType,
    );
  }

  @Get(':id')
  @RequirePermission('Pendidikan', 'view')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.pendidikanService.findOne(id);
  }

  @Post()
  @RequirePermission('Pendidikan', 'create')
  async create(@Body() data: CreatePendidikanDto) {
    return this.pendidikanService.create(data);
  }

  @Put(':id')
  @RequirePermission('Pendidikan', 'update')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdatePendidikanDto,
  ) {
    return this.pendidikanService.update(id, data);
  }

  @Delete(':id')
  @RequirePermission('Pendidikan', 'delete')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.pendidikanService.remove(id);
    return { message: 'Pendidikan berhasil dihapus' };
  }
}

