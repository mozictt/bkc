import { Injectable, InternalServerErrorException, NotFoundException, StreamableFile } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateGalleryDto } from './dto/create-gallery.dto';
import { UpdateGalleryDto } from './dto/update-gallery.dto';
import { Gallery } from './entities/gallery.entity';
import type { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { MulterFile } from '@common/types/multer-file.type';

@Injectable()
export class GalleryService {
  private readonly storagePath = path.join(process.cwd(), 'storage/uploads/gallery');

  constructor(
    @InjectRepository(Gallery)
    private readonly galleryRepo: Repository<Gallery>,
    private readonly tenantContext: TenantContextService,
  ) {}

  private getTenantFilter() {
    const role = this.tenantContext.getRole();
    if (role === 'Super Admin') return {};
    return { tenantId: this.tenantContext.getTenantId() };
  }

  async processAndSaveFiles(files: MulterFile[], dto: CreateGalleryDto) {
    if (!files || files.length === 0) {
      throw new InternalServerErrorException('Tidak ada file yang diunggah');
    }

    try {
      const galleryEntities = files.map((file) => {
        const mediaType = file.mimetype.includes('video') ? 'video' : 'photo';
        
        return this.galleryRepo.create({
          albumId: dto.albumId || undefined,
          fileName: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          path: `/gallery/media/${file.filename}`, 
          type: mediaType,
        });
      });

      const savedMedia = await this.galleryRepo.save(galleryEntities);

      return {
        message: 'Berhasil mengunggah file media',
        data: savedMedia,
      };
    } catch (error) {
      // Rollback: delete physical files if DB save fails
      files.forEach(file => {
        const filePath = path.join(this.storagePath, file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      throw new InternalServerErrorException('Gagal memproses dan menyimpan media');
    }
  }

  streamMedia(filename: string, res: Response): StreamableFile {
    // Sanitize filename to prevent Path Traversal attacks
    const sanitizedFilename = path.basename(filename);
    const filePath = path.join(this.storagePath, sanitizedFilename);
    
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('File media tidak ditemukan');
    }

    const file = fs.createReadStream(filePath);
    
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.mp4') contentType = 'video/mp4';
    else if (ext === '.webm') contentType = 'video/webm';

    return new StreamableFile(file, {
      type: contentType,
      disposition: `inline; filename="${filename}"`,
    });
  }

  async findAll() {
    return this.galleryRepo.find({ 
      where: this.getTenantFilter(),
      order: { createdAt: 'DESC' },
      relations: ['album'],
    });
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
    
    const filePath = path.join(this.storagePath, gallery.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await this.galleryRepo.remove(gallery);
    return { message: 'Media berhasil dihapus' };
  }
}
