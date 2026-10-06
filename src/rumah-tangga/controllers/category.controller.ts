import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { RequirePermission } from '../../permissions/decorators/require-permission.decorator';
import { CategoryService } from '../services/category.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { CategoryType } from '../constants/category-type.enum';

@ApiTags('Rumah Tangga - Kategori')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('rumah-tangga/categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  @RequirePermission('rumah-tangga.kategori', 'view')
  @ApiOperation({ summary: 'List semua kategori aktif' })
  async findAll(@Query('type') type?: CategoryType) {
    return this.categoryService.findAll(type);
  }

  @Get('admin')
  @RequirePermission('rumah-tangga.kategori', 'manage')
  @ApiOperation({ summary: 'List semua kategori termasuk nonaktif (admin)' })
  async findAllAdmin(@Query('type') type?: CategoryType) {
    return this.categoryService.findAllAdmin(type);
  }

  @Get(':id')
  @RequirePermission('rumah-tangga.kategori', 'view')
  @ApiOperation({ summary: 'Detail kategori berdasarkan ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.findOne(id);
  }

  @Post()
  @RequirePermission('rumah-tangga.kategori', 'create')
  @ApiOperation({ summary: 'Tambah kategori baru' })
  async create(@Body() dto: CreateCategoryDto) {
    return this.categoryService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('rumah-tangga.kategori', 'update')
  @ApiOperation({ summary: 'Update kategori' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoryService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('rumah-tangga.kategori', 'delete')
  @ApiOperation({ summary: 'Soft delete kategori' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.categoryService.remove(id);
    return { message: 'Kategori berhasil dihapus' };
  }
}
