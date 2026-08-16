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
  Req,
  Res,
  Query,
  UnprocessableEntityException,
  UseGuards,
  StreamableFile,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { GalleryService } from './gallery.service';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { UpdateGalleryDto } from './dto/update-gallery.dto';
import { diskStorage } from 'multer';
import * as path from 'path';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { MulterFile } from '@common/types/multer-file.type';
import { ApiBearerAuth, ApiTags, ApiConsumes, ApiBody, ApiHeader, ApiQuery, ApiResponse, ApiOperation } from '@nestjs/swagger';

import { QueryGalleryDto } from './dto/query-gallery.dto';
import { BulkActionDto } from './dto/bulk-action.dto';

@ApiTags('Gallery')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('gallery')
export class GalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  @Post('upload-bulk')
  @RequirePermission('Gallery', 'create')
  @ApiOperation({ summary: 'Unggah banyak foto/video galeri ke folder berdasarkan slug tenant dan nama album' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        albumId: { type: 'string', format: 'uuid', description: 'ID Album opsional (UUID). Jika diisi, media disimpan di /storage/uploads/gallery/{slug}/{nama_album}' },
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
          const tempPath = path.join(process.cwd(), 'storage/uploads/gallery/.tmp');
          if (!fs.existsSync(tempPath)) {
            fs.mkdirSync(tempPath, { recursive: true });
          }
          cb(null, tempPath);
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

  @Get('media/*path')
  @RequirePermission('Gallery', 'view')
  @ApiOperation({ summary: 'Stream / ambil file media galeri berdasarkan relative path (slug/judul/filename)' })
  @ApiHeader({
    name: 'range',
    required: false,
    description: 'Header Byte Range untuk video streaming (cth: bytes=0-1048575)',
  })
  @ApiQuery({
    name: 'token',
    required: false,
    description: 'JWT Bearer token dalam query string untuk pemutar media HTML5 native',
  })
  @ApiResponse({
    status: 200,
    description: 'Mengembalikan file media secara utuh (gambar atau download penuh).',
  })
  @ApiResponse({
    status: 206,
    description: 'Partial Content - Mengembalikan potongan chunk video untuk streaming.',
  })
  @ApiResponse({
    status: 416,
    description: 'Range Not Satisfiable - Byte range yang diminta melebihi ukuran file.',
  })
  async getMedia(
    @Req() req: Request,
    @Res() res: Response,
    @Query('token') token?: string,
  ) {
    const rawPath = (req.params as any).path || req.params[0] || req.params['0'] || '';
    return this.galleryService.streamMedia(rawPath, req, res);
  }

  @Get()
  @RequirePermission('Gallery', 'view')
  @ApiOperation({ summary: 'Mendapatkan daftar media galeri terpaginasi dengan filter albumId, search, dan type' })
  findAll(@Query() queryDto: QueryGalleryDto) {
    return this.galleryService.findAll(queryDto);
  }

  @Delete('bulk')
  @RequirePermission('Gallery', 'delete')
  @ApiOperation({ summary: 'Menghapus beberapa media galeri sekaligus' })
  @ApiResponse({ status: 200, description: 'Media berhasil dihapus massal' })
  removeBulk(@Body() bulkActionDto: BulkActionDto) {
    return this.galleryService.removeBulk(bulkActionDto);
  }

  @Post('download-bulk')
  @RequirePermission('Gallery', 'view')
  @ApiOperation({ summary: 'Mengunduh beberapa media galeri sekaligus sebagai file ZIP' })
  @ApiResponse({ status: 200, description: 'Stream berkas ZIP berisi media terpilih' })
  downloadBulk(@Body() bulkActionDto: BulkActionDto): Promise<StreamableFile> {
    return this.galleryService.downloadBulk(bulkActionDto);
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
