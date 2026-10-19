import { Injectable, InternalServerErrorException, NotFoundException, BadRequestException, StreamableFile } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, ILike, In } from 'typeorm';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { UpdateGalleryDto } from './dto/update-gallery.dto';
import { UploadChunkDto } from './dto/upload-chunk.dto';
import { Gallery } from './entities/gallery.entity';
import { Album } from './entities/album.entity';
import type { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { execFile } from 'child_process';
import { promisify } from 'util';
import sharp from 'sharp';

const execFileAsync = promisify(execFile);
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
      const galleryEntities = await Promise.all(
        files.map(async (file) => {
          const mediaType = file.mimetype.includes('video') ? 'video' : 'photo';
          const targetFilePath = path.join(absoluteFolder, file.filename);

          // Resolusi path sumber (temp file)
          const sourcePath = file.path
            ? (path.isAbsolute(file.path) ? file.path : path.resolve(process.cwd(), file.path))
            : path.join(process.cwd(), 'storage/uploads/gallery/.tmp', file.filename);

          if (!fs.existsSync(sourcePath)) {
            throw new InternalServerErrorException(`File upload sementara tidak ditemukan di ${sourcePath}`);
          }

          // Pindahkan file dari temp storage ke folder tujuan via Helper
          UploadStorageHelper.moveFile(sourcePath, targetFilePath);
          movedFiles.push(targetFilePath);

          // Generate thumbnail untuk foto (.webp via sharp) atau video (.webp via ffmpeg)
          try {
            const thumbPath = UploadStorageHelper.getThumbnailPath(targetFilePath);
            UploadStorageHelper.ensureDirectoryExists(path.dirname(thumbPath));

            if (mediaType === 'photo') {
              await sharp(targetFilePath)
                .rotate() // Auto-orient berdasarkan metadata EXIF kamera HP sebelum resize
                .resize({ width: 400, height: 400, fit: 'cover', withoutEnlargement: true })
                .webp({ quality: 75 })
                .toFile(thumbPath);
            } else if (mediaType === 'video') {
              // Asynchronous non-blocking: jalankan optimasi FFmpeg di background agar request HTTP
              // langsung selesai dan tidak terputus oleh batas waktu gateway Cloudflare Tunnel (100s)
              setImmediate(async () => {
                try {
                  await this.generateVideoThumbnail(targetFilePath, thumbPath);
                  await this.optimizeVideoFastStart(targetFilePath);
                } catch (bgErr) {
                  console.warn(`[GalleryService] Gagal memproses video di background (${targetFilePath}):`, bgErr);
                }
              });
            }
          } catch (err) {
            console.warn(`[GalleryService] Gagal generate thumbnail untuk ${targetFilePath}:`, err);
          }

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
        })
      );

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

  /**
   * Menangani unggahan potongan berkas (Chunked Upload).
   * Mencegah pembatasan 100MB Cloudflare Zero Trust Free dan mengoptimalkan penggunaan memori server via Stream.
   */
  async handleChunkUpload(file: MulterFile, dto: UploadChunkDto) {
    if (!file) {
      throw new BadRequestException('Potongan berkas (chunk) tidak ditemukan');
    }

    // Sanitasi uploadId untuk mencegah path traversal
    const sanitizedUploadId = dto.uploadId.replace(/[^a-zA-Z0-9_\-]/g, '');
    if (!sanitizedUploadId) {
      throw new BadRequestException('ID sesi unggah tidak valid');
    }

    const chunkDir = path.join(process.cwd(), 'storage/uploads/gallery/.chunks', sanitizedUploadId);
    UploadStorageHelper.ensureDirectoryExists(chunkDir);

    const chunkPath = path.join(chunkDir, `${dto.chunkIndex}.part`);

    // Pindahkan potongan multer sementara ke direktori chunk
    const sourcePath = file.path
      ? (path.isAbsolute(file.path) ? file.path : path.resolve(process.cwd(), file.path))
      : path.join(process.cwd(), 'storage/uploads/gallery/.tmp', file.filename);

    if (fs.existsSync(sourcePath)) {
      UploadStorageHelper.moveFile(sourcePath, chunkPath);
    } else {
      throw new InternalServerErrorException('Gagal menyimpan potongan berkas sementara');
    }

    // Periksa kelengkapan semua potongan (0 sampai totalChunks - 1)
    let allChunksExist = true;
    for (let i = 0; i < dto.totalChunks; i++) {
      if (!fs.existsSync(path.join(chunkDir, `${i}.part`))) {
        allChunksExist = false;
        break;
      }
    }

    // Jika potongan belum lengkap, kembalikan respons sukses parsial
    if (!allChunksExist) {
      return {
        success: true,
        complete: false,
        uploadId: sanitizedUploadId,
        chunkIndex: dto.chunkIndex,
        totalChunks: dto.totalChunks,
        message: `Potongan ${dto.chunkIndex + 1}/${dto.totalChunks} berhasil diunggah`,
      };
    }

    // SEMUA POTONGAN LENGKAP: Rakit potongan berkas secara streaming
    const tempDir = path.join(process.cwd(), 'storage/uploads/gallery/.tmp');
    UploadStorageHelper.ensureDirectoryExists(tempDir);

    let ext = path.extname(dto.fileName).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.webm', '.mov', '.mkv', '.avi'].includes(ext)) {
      ext = '.bin';
    }

    const uniqueSuffix = `${Date.now()}-${randomUUID()}`;
    const assembledFileName = `${uniqueSuffix}${ext}`;
    const assembledFilePath = path.join(tempDir, assembledFileName);

    try {
      const writeStream = fs.createWriteStream(assembledFilePath);

      for (let i = 0; i < dto.totalChunks; i++) {
        const partPath = path.join(chunkDir, `${i}.part`);
        await new Promise<void>((resolve, reject) => {
          const readStream = fs.createReadStream(partPath);
          readStream.pipe(writeStream, { end: false });
          readStream.on('end', () => resolve());
          readStream.on('error', (err) => reject(err));
        });
      }
      writeStream.end();

      // Tunggu hingga buffer selesai ditulis ke disk
      await new Promise<void>((resolve, reject) => {
        writeStream.on('finish', () => resolve());
        writeStream.on('error', (err) => reject(err));
      });

      // Bersihkan folder chunk
      fs.rmSync(chunkDir, { recursive: true, force: true });

      // Deteksi MIME type
      let mimeType = 'application/octet-stream';
      if (['.jpg', '.jpeg'].includes(ext)) mimeType = 'image/jpeg';
      else if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      else if (ext === '.gif') mimeType = 'image/gif';
      else if (['.mp4', '.m4v'].includes(ext)) mimeType = 'video/mp4';
      else if (ext === '.webm') mimeType = 'video/webm';
      else if (ext === '.mov') mimeType = 'video/quicktime';
      else if (ext === '.mkv') mimeType = 'video/x-matroska';
      else if (ext === '.avi') mimeType = 'video/x-msvideo';

      const stat = fs.statSync(assembledFilePath);

      // Buat struktur MulterFile buatan dari file yang sudah dirakit
      const assembledMulterFile: MulterFile = {
        fieldname: 'files',
        originalname: dto.fileName,
        encoding: '7bit',
        mimetype: mimeType,
        size: stat.size,
        destination: tempDir,
        filename: assembledFileName,
        path: assembledFilePath,
      };

      // Simpan ke storage album dan database
      const saveResult = await this.processAndSaveFiles([assembledMulterFile], {
        albumId: dto.albumId,
      });

      return {
        success: true,
        complete: true,
        uploadId: sanitizedUploadId,
        message: 'Berkas video/gambar berhasil digabungkan dan disimpan',
        data: saveResult.data,
      };
    } catch (assemblyError) {
      if (fs.existsSync(assembledFilePath)) {
        fs.unlinkSync(assembledFilePath);
      }
      if (fs.existsSync(chunkDir)) {
        fs.rmSync(chunkDir, { recursive: true, force: true });
      }
      throw new InternalServerErrorException(
        `Gagal menggabungkan potongan berkas: ${assemblyError instanceof Error ? assemblyError.message : String(assemblyError)}`,
      );
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
    else if (ext === '.gif') contentType = 'image/gif';
    else if (['.mp4', '.m4v'].includes(ext)) contentType = 'video/mp4';
    else if (ext === '.webm') contentType = 'video/webm';
    else if (ext === '.mov') contentType = 'video/quicktime';
    else if (ext === '.mkv') contentType = 'video/x-matroska';
    else if (ext === '.avi') contentType = 'video/x-msvideo';
    else if (['.ogv', '.ogg'].includes(ext)) contentType = 'video/ogg';

    const isVideoFile = contentType.startsWith('video/') || ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.m4v', '.3gp'].includes(ext);

    // Respons 206 Partial Content jika ada header Range dan tipe file adalah video
    if (range && isVideoFile) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);

      if (isNaN(start) || start >= fileSize || start < 0) {
        res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
        return res.end();
      }

      let end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (isNaN(end) || end >= fileSize) {
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

  /**
   * Helper private untuk memindahkan MOOV atom (metadata MP4) ke awal file (+faststart)
   * agar video dapat langsung di-stream dan terputar tanpa delay di server cloud.
   */
  private async optimizeVideoFastStart(inputAbsPath: string): Promise<void> {
    const tempPath = `${inputAbsPath}.faststart.mp4`;
    try {
      let ffmpegExec = 'ffmpeg';
      try {
        const staticPath = require('ffmpeg-static');
        if (staticPath) {
          ffmpegExec = staticPath;
        }
      } catch (e) {}

      await execFileAsync(
        ffmpegExec,
        [
          '-i', inputAbsPath,
          '-c', 'copy',
          '-movflags', '+faststart',
          '-y',
          tempPath,
        ],
        { timeout: 180000 }, // 180 detik (3 menit) agar proses remux video besar tidak terputus
      );

      if (fs.existsSync(tempPath)) {
        fs.renameSync(tempPath, inputAbsPath);
      }
    } catch (err) {
      console.warn(`[GalleryService] Gagal menerapkan faststart pada ${inputAbsPath}:`, err);
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }

  /**
   * Helper private untuk mengekstrak 1 frame dari file video (pada 00:00:01)
   * menggunakan ffmpeg dan menyimpannya sebagai file gambar .webp (~15KB) di storage.
   */
  private async generateVideoThumbnail(videoAbsPath: string, thumbAbsPath: string): Promise<boolean> {
    try {
      UploadStorageHelper.ensureDirectoryExists(path.dirname(thumbAbsPath));
      let ffmpegExec = 'ffmpeg';
      try {
        const staticPath = require('ffmpeg-static');
        if (staticPath) {
          ffmpegExec = staticPath;
        }
      } catch (e) {
        // Fallback ke system 'ffmpeg'
      }

      await execFileAsync(ffmpegExec, [
        '-ss', '00:00:01',
        '-i', videoAbsPath,
        '-vframes', '1',
        '-vf', 'scale=400:-1',
        '-y',
        thumbAbsPath,
      ], { timeout: 45000 }); // 45 detik untuk video berukuran besar
      return fs.existsSync(thumbAbsPath);
    } catch (err) {
      console.warn(`[GalleryService] Gagal ekstrak thumbnail video via ffmpeg (${videoAbsPath}):`, err);
      return false;
    }
  }

  /**
   * Melayani file thumbnail statis (.webp ~15KB) untuk FOTO maupun VIDEO.
   * JANGAN PERNAH men-stream file MP4 di endpoint thumbnail agar RAM Server tidak habis.
   */
  async streamThumbnail(rawPath: string, req: Request, res: Response) {
    const filePath = UploadStorageHelper.resolveFileForStreaming(rawPath, 'gallery');

    if (!filePath) {
      throw new NotFoundException('File media tidak ditemukan');
    }

    const ext = path.extname(filePath).toLowerCase();
    const isPhoto = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.jfif', '.heic', '.heif', '.avif'].includes(ext);
    const thumbPath = UploadStorageHelper.getThumbnailPath(filePath);

    // 1. Jika file thumbnail .webp belum ada di disk, buat secara on-the-fly
    if (!fs.existsSync(thumbPath)) {
      try {
        UploadStorageHelper.ensureDirectoryExists(path.dirname(thumbPath));
        if (isPhoto) {
          await sharp(filePath)
            .rotate() // Auto-orient berdasarkan metadata EXIF kamera HP sebelum resize
            .resize({ width: 400, height: 400, fit: 'cover', withoutEnlargement: true })
            .webp({ quality: 75 })
            .toFile(thumbPath);
        } else {
          await this.generateVideoThumbnail(filePath, thumbPath);
        }
      } catch (err) {
        console.warn(`[GalleryService] Gagal generate thumbnail on-the-fly untuk ${filePath}:`, err);
      }
    }

    // 2. Jika file thumbnail .webp berhasil dibuat / sudah ada -> Sajikan static file WebP (~15KB)
    if (fs.existsSync(thumbPath)) {
      const stat = fs.statSync(thumbPath);
      res.writeHead(200, {
        'Content-Type': 'image/webp',
        'Content-Length': stat.size,
        'Cache-Control': 'public, max-age=86400',
      });
      return fs.createReadStream(thumbPath).pipe(res);
    }

    // 3. Fallback jika thumbnail belum ada di server:
    // Kembalikan 404 agar frontend otomatis beralih ke video frame preview (#t=0.5) browser
    throw new NotFoundException('Thumbnail belum tersedia');
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

