import { Injectable, InternalServerErrorException, NotFoundException, StreamableFile } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, ILike, In } from 'typeorm';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { UpdateGalleryDto } from './dto/update-gallery.dto';
import { Gallery } from './entities/gallery.entity';
import { Album } from './entities/album.entity';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { MulterFile } from '@common/types/multer-file.type';
import { UploadStorageHelper } from '@common/utils/upload-storage.util';
import archiver = require('archiver');

import { QueryGalleryDto } from './dto/query-gallery.dto';
import { BulkActionDto } from './dto/bulk-action.dto';

@Injectable()
export class GalleryService {
  constructor(
    @InjectRepository(Gallery)
    private readonly galleryRepo: Repository<Gallery>,
    @InjectRepository(Album)
    private readonly albumRepo: Repository<Album>,
    private readonly tenantContext: TenantContextService,
  ) {}

  private getTenantFilter() {
    return { tenantId: this.tenantContext.getTenantId() };
  }

  /**
   * Menghasilkan path folder penyimpanan gallery menggunakan UploadStorageHelper terpusat.
   */
  getGalleryUploadPath(slug?: string, albumName?: string): { relativeFolder: string; absoluteFolder: string } {
    return UploadStorageHelper.getUploadPath(slug, 'gallery', albumName || 'uncategorized');
  }

  async processAndSaveFiles(files: MulterFile[], dto: CreateGalleryDto) {
    if (!files || files.length === 0) {
      throw new InternalServerErrorException('Tidak ada file yang diunggah');
    }

    // 1. Ambil slug dari TenantContext
    const slug = this.tenantContext.getSlug() || 'default';

    // 2. Ambil nama album jika albumId diberikan
    let albumName = 'uncategorized';
    let albumEntity: Album | null = null;

    if (dto.albumId) {
      albumEntity = await this.albumRepo.findOne({
        where: { id: dto.albumId, ...this.getTenantFilter() },
      });
      if (albumEntity) {
        albumName = albumEntity.name;
      }
    }

    // 3. Dapatkan path folder penyimpanan terpusat
    const { relativeFolder, absoluteFolder } = this.getGalleryUploadPath(slug, albumName);
    UploadStorageHelper.ensureDirectoryExists(absoluteFolder);

    const movedFiles: string[] = [];

    try {
      const galleryEntities = files.map((file) => {
        const mediaType = file.mimetype.includes('video') ? 'video' : 'photo';
        const targetFilePath = path.join(absoluteFolder, file.filename);

        // Resolusi path sumber (temp file)
        const sourcePath = file.path
          ? (path.isAbsolute(file.path) ? file.path : path.resolve(process.cwd(), file.path))
          : path.join(process.cwd(), 'storage/uploads/.tmp', file.filename);

        if (!fs.existsSync(sourcePath)) {
          throw new InternalServerErrorException(`File upload sementara tidak ditemukan di ${sourcePath}`);
        }

        // Pindahkan file dari temp storage ke folder tujuan via Helper
        UploadStorageHelper.moveFile(sourcePath, targetFilePath);
        movedFiles.push(targetFilePath);

        const storedFileName = path.join(relativeFolder, file.filename).replace(/\\/g, '/');

        return this.galleryRepo.create({
          albumId: albumEntity ? albumEntity.id : (dto.albumId || undefined),
          fileName: storedFileName,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          path: `/gallery/media/${storedFileName}`, 
          type: mediaType,
        });
      });

      const savedMedia = await this.galleryRepo.save(galleryEntities);

      return {
        message: 'Berhasil mengunggah file media',
        data: savedMedia,
      };
    } catch (error) {
      // Rollback: hapus file fisik yang sudah terlanjur dipindahkan jika DB save gagal
      movedFiles.forEach((filePath) => {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      // Hapus file temp jika tersisa
      files.forEach((file) => {
        const tempPath = file.path
          ? (path.isAbsolute(file.path) ? file.path : path.resolve(process.cwd(), file.path))
          : path.join(process.cwd(), 'storage/uploads/.tmp', file.filename);

        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      });
      throw error instanceof InternalServerErrorException
        ? error
        : new InternalServerErrorException('Gagal memproses dan menyimpan media');
    }
  }

  streamMedia(rawPath: string, req: Request, res: Response) {
    const filePath = UploadStorageHelper.resolveFileForStreaming(rawPath, 'gallery');

    if (!filePath) {
      throw new NotFoundException('File media tidak ditemukan');
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;
    
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'application/octet-stream';
    if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.mp4') contentType = 'video/mp4';
    else if (ext === '.webm') contentType = 'video/webm';

    const MAX_CHUNK_SIZE = 3 * 1024 * 1024; // 3MB per chunk untuk responsivitas streaming & seeking

    // Respons 206 Partial Content jika ada header Range dan tipe file adalah video
    if (range && contentType.startsWith('video/')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      
      if (isNaN(start) || start >= fileSize || start < 0) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
        return res.end();
      }

      let end = parts[1] ? parseInt(parts[1], 10) : start + MAX_CHUNK_SIZE - 1;

      if (isNaN(end) || end - start + 1 > MAX_CHUNK_SIZE) {
        end = start + MAX_CHUNK_SIZE - 1;
      }

      if (end >= fileSize) {
        end = fileSize - 1;
      }

      if (start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
        return res.end();
      }

      const chunkSize = end - start + 1;
      const stream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      });

      stream.pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=31536000, immutable',
      });

      fs.createReadStream(filePath).pipe(res);
    }
  }

  async findAll(queryDto?: QueryGalleryDto) {
    const page = Number(queryDto?.page) || 1;
    const limit = Number(queryDto?.limit) || 24;
    const skip = (page - 1) * limit;

    const tenantFilter = this.getTenantFilter();
    const where: any = { ...tenantFilter };

    if (queryDto?.albumId) {
      if (queryDto.albumId === 'uncategorized') {
        where.albumId = IsNull();
      } else {
        where.albumId = queryDto.albumId;
      }
    }

    if (queryDto?.type) {
      where.type = queryDto.type;
    }

    if (queryDto?.search) {
      where.originalName = ILike(`%${queryDto.search}%`);
    }

    const sortBy = queryDto?.sortBy || 'createdAt';
    const sortType = (queryDto?.sortType || 'DESC').toUpperCase() as 'ASC' | 'DESC';

    const [items, totalItems] = await this.galleryRepo.findAndCount({
      where,
      order: { [sortBy]: sortType },
      skip,
      take: limit,
      relations: ['album'],
    });

    const totalPages = Math.ceil(totalItems / limit);

    return {
      success: true,
      currentPage: page,
      totalItems,
      totalPages,
      array: items,
    };
  }

  async findOne(id: string) {
    const gallery = await this.galleryRepo.findOne({ 
      where: { id, ...this.getTenantFilter() },
      relations: ['album'],
    });
    if (!gallery) {
      throw new NotFoundException(`Gallery dengan ID ${id} tidak ditemukan`);
    }
    return gallery;
  }

  async update(id: string, updateGalleryDto: UpdateGalleryDto) {
    const gallery = await this.findOne(id);
    this.galleryRepo.merge(gallery, updateGalleryDto);
    return this.galleryRepo.save(gallery);
  }

  async remove(id: string) {
    const gallery = await this.findOne(id);
    
    if (gallery.fileName) {
      UploadStorageHelper.removeFile(gallery.fileName, 'gallery');
    }

    await this.galleryRepo.remove(gallery);
    return { message: 'Media berhasil dihapus' };
  }

  async removeBulk(dto: BulkActionDto) {
    const tenantFilter = this.getTenantFilter();
    const galleries = await this.galleryRepo.find({
      where: {
        id: In(dto.ids),
        ...tenantFilter,
      },
    });

    if (galleries.length === 0) {
      throw new NotFoundException('Tidak ada media yang ditemukan untuk dihapus');
    }

    // Hapus file fisik dari disk
    for (const gallery of galleries) {
      if (gallery.fileName) {
        UploadStorageHelper.removeFile(gallery.fileName, 'gallery');
      }
    }

    // Hapus dari database
    await this.galleryRepo.remove(galleries);
    return {
      success: true,
      message: `Berhasil menghapus ${galleries.length} media`,
    };
  }

  async downloadBulk(dto: BulkActionDto): Promise<StreamableFile> {
    const tenantFilter = this.getTenantFilter();
    const galleries = await this.galleryRepo.find({
      where: {
        id: In(dto.ids),
        ...tenantFilter,
      },
    });

    if (galleries.length === 0) {
      throw new NotFoundException('Tidak ada media yang ditemukan untuk diunduh');
    }

    let archive: any;
    if (typeof archiver === 'function') {
      archive = (archiver as any)('zip', {
        zlib: { level: 9 },
      });
    } else if (archiver && (archiver as any).ZipArchive) {
      archive = new (archiver as any).ZipArchive({
        zlib: { level: 9 },
      });
    } else {
      throw new InternalServerErrorException('Pustaka archiver tidak termuat dengan benar');
    }

    // Handle archive errors
    archive.on('error', (err) => {
      throw new InternalServerErrorException(err.message);
    });

    for (const gallery of galleries) {
      const filePath = UploadStorageHelper.resolveFileForStreaming(gallery.fileName, 'gallery');
      if (filePath && fs.existsSync(filePath)) {
        // Gunakan originalName jika unik, atau fallback ke fileName agar tidak ada bentrok nama file dalam zip
        archive.file(filePath, { name: gallery.originalName || path.basename(filePath) });
      }
    }

    // Trigger finalisasi secara asinkron
    archive.finalize();

    return new StreamableFile(archive, {
      type: 'application/zip',
      disposition: 'attachment; filename=gallery-download.zip',
    });
  }
}

