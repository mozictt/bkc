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
import { AgamaService } from '../services/agama.service';
import { CreateAgamaDto } from '../dto/create-agama.dto';
import { UpdateAgamaDto } from '../dto/update-agama.dto';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { PermissionGuard } from '@src/permissions/guards/permission.guard';
import { RequirePermission } from '@src/permissions/decorators/require-permission.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Master - Agama')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('master/agama')
export class AgamaController {
  constructor(private readonly agamaService: AgamaService) {}

  @Get()
  @RequirePermission('Agama', 'view')
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('search') search = '',
    @Query('sortBy') sortBy = 'id',
    @Query('sortType') sortType = 'desc',
  ) {
    return this.agamaService.findAll(+page, +limit, search, sortBy, sortType);
  }

  @Get(':id')
  @RequirePermission('Agama', 'view')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.agamaService.findOne(id);
  }

  @Post()
  @RequirePermission('Agama', 'create')
  async create(@Body() data: CreateAgamaDto) {
    return this.agamaService.create(data);
  }

  @Put(':id')
  @RequirePermission('Agama', 'update')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdateAgamaDto,
  ) {
    return this.agamaService.update(id, data);
  }

  @Delete(':id')
  @RequirePermission('Agama', 'delete')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.agamaService.remove(id);
    return { message: 'Agama berhasil dihapus' };
  }
}

