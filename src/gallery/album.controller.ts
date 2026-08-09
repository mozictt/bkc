import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { AlbumService } from './album.service';
import { CreateAlbumDto } from './dto/create-album.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Albums')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('albums')
export class AlbumController {
  constructor(private readonly albumService: AlbumService) {}

  @Post()
  @RequirePermission('Album', 'create')
  create(@Body() createAlbumDto: CreateAlbumDto) {
    return this.albumService.create(createAlbumDto);
  }

  @Get()
  @RequirePermission('Album', 'view')
  findAll() {
    return this.albumService.findAll();
  }

  @Get(':id')
  @RequirePermission('Album', 'view')
  findOne(@Param('id') id: string) {
    return this.albumService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('Album', 'update')
  update(@Param('id') id: string, @Body() updateAlbumDto: Partial<CreateAlbumDto>) {
    return this.albumService.update(id, updateAlbumDto);
  }

  @Delete(':id')
  @RequirePermission('Album', 'delete')
  remove(@Param('id') id: string) {
    return this.albumService.remove(id);
  }
}
