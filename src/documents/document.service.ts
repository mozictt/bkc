import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document } from './entities/document.entity';
import { CreateDocumentDto } from './dto/create-document.dto';
import { QueryDocumentDto } from './dto/query-document.dto';
import { TenantContextService } from '@common/tenant/tenant-context.service';
import { UploadStorageHelper } from '@common/utils/upload-storage.util';
import { MulterFile } from '@common/types/multer-file.type';
import type { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class DocumentService {
  constructor(
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    private readonly tenantContext: TenantContextService,
  ) {}

  private getTenantFilter() {
    return { tenantId: this.tenantContext.getTenantId() };
  }

  async saveFile(file: MulterFile, dto: CreateDocumentDto, userId: number) {
    if (!file) {
      throw new NotFoundException('Tidak ada berkas yang diunggah');
    }

    const slug = this.tenantContext.getSlug() || 'default';
    const { relativeFolder, absoluteFolder } = UploadStorageHelper.getUploadPath(slug, 'documents');
    
    // Pastikan folder tujuan ada di disk
    UploadStorageHelper.ensureDirectoryExists(absoluteFolder);

    const targetFilePath = path.join(absoluteFolder, file.filename);
    const sourcePath = file.path 
      ? (path.isAbsolute(file.path) ? file.path : path.resolve(process.cwd(), file.path))
      : path.join(process.cwd(), 'storage/uploads/documents/.tmp', file.filename);

    if (!fs.existsSync(sourcePath)) {
      throw new InternalServerErrorException('Berkas sementara tidak ditemukan');
    }

    try {
      // Pindahkan file dari temp ke folder tujuan
      UploadStorageHelper.moveFile(sourcePath, targetFilePath);

      const relativeStoredPath = path.join(relativeFolder, file.filename).replace(/\\/g, '/');
      const ext = path.extname(file.originalname).toLowerCase().replace('.', '') || 'bin';

      const doc = this.documentRepo.create({
        fileName: relativeStoredPath,
        originalName: file.originalname,
        mimeType: file.mimetype,
        extension: ext,
        size: file.size,
        path: `/documents/download/${relativeStoredPath}`,
        description: dto.description,
        uploadedById: userId,
        tenantId: this.tenantContext.getTenantId(),
      });

      return await this.documentRepo.save(doc);
    } catch (error) {
      console.error('[DocumentService] Gagal menyimpan dokumen ke basis data:', error);
      // Rollback file jika DB save gagal
      if (fs.existsSync(targetFilePath)) fs.unlinkSync(targetFilePath);
      if (fs.existsSync(sourcePath)) fs.unlinkSync(sourcePath);
      throw new InternalServerErrorException('Gagal menyimpan metadata dokumen ke basis data');
    }
  }

  async findAll(queryDto: QueryDocumentDto) {
    const page = Number(queryDto.page) || 1;
    const limit = Number(queryDto.limit) || 10;
    const skip = (page - 1) * limit;

    const tenantFilter = this.getTenantFilter();
    
    // Cegah Masalah N+1 Query dengan LEFT JOIN user pengunggah secara eksplisit
    const query = this.documentRepo.createQueryBuilder('doc')
      .leftJoinAndSelect('doc.uploadedBy', 'user')
      .select([
        'doc.id',
        'doc.originalName',
        'doc.mimeType',
        'doc.extension',
        'doc.size',
        'doc.path',
        'doc.description',
        'doc.createdAt',
        'user.id',
        'user.username',
      ]);

    // Terapkan filter tenant
    if (tenantFilter.tenantId) {
      query.where('doc.tenantId = :tenantId', { tenantId: tenantFilter.tenantId });
    } else {
      query.where('1=1');
    }

    if (queryDto.search) {
      query.andWhere('doc.originalName ILike :search', { search: `%${queryDto.search}%` });
    }

    if (queryDto.extension) {
      query.andWhere('doc.extension = :ext', { ext: queryDto.extension.toLowerCase() });
    }

    const sortBy = queryDto.sortBy || 'createdAt';
    const sortType = queryDto.sortType || 'DESC';
    query.orderBy(`doc.${sortBy}`, sortType);

    const [items, totalItems] = await query
      .skip(skip)
      .take(limit)
      .getManyAndCount();

    const totalPages = Math.ceil(totalItems / limit);

    return {
      success: true,
      currentPage: page,
      totalItems,
      totalPages,
      array: items,
    };
  }

  async downloadFile(rawPath: string, res: Response) {
    // Gunakan UploadStorageHelper untuk resolusi file yang aman & anti path traversal
    const filePath = UploadStorageHelper.resolveFileForStreaming(rawPath, 'documents');

    if (!filePath || !fs.existsSync(filePath)) {
      throw new NotFoundException('Dokumen tidak ditemukan di penyimpanan server');
    }

    const stat = fs.statSync(filePath);
    const fileName = path.basename(filePath);

    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
    });

    fs.createReadStream(filePath).pipe(res);
  }

  async remove(id: string) {
    const doc = await this.documentRepo.findOne({
      where: { id, ...this.getTenantFilter() }
    });

    if (!doc) {
      throw new NotFoundException('Dokumen tidak ditemukan');
    }

    // Hapus berkas fisik
    if (doc.fileName) {
      UploadStorageHelper.removeFile(doc.fileName, 'documents');
    }

    await this.documentRepo.remove(doc);
    return { success: true, message: 'Dokumen berhasil dihapus' };
  }
}
