import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GalleryService } from './gallery.service';
import { GalleryController } from './gallery.controller';
import { Gallery } from './entities/gallery.entity';
import { Album } from './entities/album.entity';
import { AlbumController } from './album.controller';
import { AlbumService } from './album.service';

@Module({
  imports: [TypeOrmModule.forFeature([Gallery, Album])],
  controllers: [GalleryController, AlbumController],
  providers: [GalleryService, AlbumService],
})
export class GalleryModule {}
