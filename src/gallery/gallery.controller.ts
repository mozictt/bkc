import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
  ParseFilePipeBuilder,
  HttpStatus,
  StreamableFile,
  Res,
  UnprocessableEntityException,
  UseGuards,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { GalleryService } from './gallery.service';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { UpdateGalleryDto } from './dto/update-gallery.dto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { MulterFile } from '@common/types/multer-file.type';
import { ApiBearerAuth, ApiTags, ApiConsumes, ApiBody } from '@nestjs/swagger';

@ApiTags('Gallery')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('gallery')
export class GalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  @Post('upload-bulk')
  @RequirePermission('Gallery', 'create')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        albumId: { type: 'string', format: 'uuid', description: 'ID Album opsional (UUID)' },
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Pilih foto atau video untuk diunggah (Max 20 file)',
        },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor('files', 20, {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const path = './storage/uploads/gallery';
          if (!fs.existsSync(path)) {
            fs.mkdirSync(path, { recursive: true });
          }
          cb(null, path);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${randomUUID()}`;
          let ext = extname(file.originalname).toLowerCase();
          // Fallback aman jika ekstensi diakali
          if (!['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm'].includes(ext)) {
            ext = '.bin';
          }
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 500 * 1024 * 1024, // 500MB max per file
      },
      fileFilter: (req, file, cb) => {
        // Validasi ganda: Ekstensi dan MIME Type untuk mencegah Spoofing
        const validExt = !!file.originalname.match(/\.(jpg|jpeg|png|webp|mp4|webm)$/i);
        const validMime = !!file.mimetype.match(/^(image\/(jpeg|png|webp)|video\/(mp4|webm))$/i);
        
        if (!validExt || !validMime) {
          return cb(
            new UnprocessableEntityException('Validation failed (invalid file type or mime type spoofing detected)') as any, 
            false
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadMultiple(
    @Body() createGalleryDto: CreateGalleryDto,
    @UploadedFiles() files: MulterFile[],
  ) {
    return this.galleryService.processAndSaveFiles(files, createGalleryDto);
  }

  // Endpoint untuk mengakses gambar/video dengan aman
  // Ini otomatis dilindungi oleh JwtAuthGuard global di app.module.ts
  @Get('media/:filename')
  async getMedia(
    @Param('filename') filename: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    return this.galleryService.streamMedia(filename, res);
  }

  @Get()
  @RequirePermission('Gallery', 'view')
  findAll() {
    return this.galleryService.findAll();
  }

  @Get(':id')
  @RequirePermission('Gallery', 'view')
  findOne(@Param('id') id: string) {
    return this.galleryService.findOne(id);
  }

  @Patch(':id')
  @RequirePermission('Gallery', 'update')
  update(@Param('id') id: string, @Body() updateGalleryDto: UpdateGalleryDto) {
    return this.galleryService.update(id, updateGalleryDto);
  }

  @Delete(':id')
  @RequirePermission('Gallery', 'delete')
  remove(@Param('id') id: string) {
    return this.galleryService.remove(id);
  }
}
