import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { AlbumService } from './album.service';
import { CreateAlbumDto } from './dto/create-album.dto';
import { QueryAlbumDto } from './dto/query-album.dto';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Albums')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('albums')
export class AlbumController {
  constructor(private readonly albumService: AlbumService) {}

  @Post()
  @RequirePermission('Album', 'create')
  @ApiOperation({ summary: 'Membuat album baru' })
  create(@Body() createAlbumDto: CreateAlbumDto) {
    return this.albumService.create(createAlbumDto);
  }

  @Get()
  @RequirePermission('Album', 'view')
  @ApiOperation({ summary: 'Mendapatkan daftar album dengan paginasi, pencarian, dan pengurutan' })
  @ApiResponse({
    status: 200,
    description: 'Daftar album berhasil diambil dengan format paginasi.',
  })
  findAll(@Query() query: QueryAlbumDto) {
    return this.albumService.findAll(query);
  }

  @Get(':id')
  @RequirePermission('Album', 'view')
  @ApiOperation({ summary: 'Mendapatkan detail album beserta daftar media di dalamnya' })
  findOne(@Param('id') id: string) {
    return this.albumService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('Album', 'update')
  @ApiOperation({ summary: 'Memperbarui data album' })
  update(@Param('id') id: string, @Body() updateAlbumDto: Partial<CreateAlbumDto>) {
    return this.albumService.update(id, updateAlbumDto);
  }

  @Delete(':id')
  @RequirePermission('Album', 'delete')
  @ApiOperation({ summary: 'Menghapus album beserta seluruh media di dalamnya' })
  remove(@Param('id') id: string) {
    return this.albumService.remove(id);
  }
}

