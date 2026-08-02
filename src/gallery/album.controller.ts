import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '@auth/guards/permissions.guard';
import { CheckPermission } from '@auth/decorators/permissions.decorator';
import { AlbumService } from './album.service';
import { CreateAlbumDto } from './dto/create-album.dto';

@UseGuards(PermissionsGuard)
@Controller('albums')
export class AlbumController {
  constructor(private readonly albumService: AlbumService) {}

  @Post()
  @CheckPermission(['manage', 'create'], 'Album')
  create(@Body() createAlbumDto: CreateAlbumDto) {
    return this.albumService.create(createAlbumDto);
  }

  @Get()
  @CheckPermission(['manage', 'view'], 'Album')
  findAll() {
    return this.albumService.findAll();
  }

  @Get(':id')
  @CheckPermission(['manage', 'view'], 'Album')
  findOne(@Param('id') id: string) {
    return this.albumService.findOne(id);
  }

  @Patch(':id')
  @CheckPermission(['manage', 'update'], 'Album')
  update(@Param('id') id: string, @Body() updateAlbumDto: Partial<CreateAlbumDto>) {
    return this.albumService.update(id, updateAlbumDto);
  }

  @Delete(':id')
  @CheckPermission(['manage', 'delete'], 'Album')
  remove(@Param('id') id: string) {
    return this.albumService.remove(id);
  }
}
