import {
  Controller,
  Post,
  Get,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiBearerAuth,
  ApiResponse,
  ApiHeader,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../auth/public.decorator';
import { MulterFile } from '@common/types/multer-file.type';
import { UploadStorageHelper } from '@common/utils/upload-storage.util';
import { TenantContextService } from '../common/tenant/tenant-context.service';

/** Ukuran maksimal file attachment chat: 50 MB */
const MAX_FILE_SIZE = 50 * 1024 * 1024;

/** Daftar MIME type yang diizinkan untuk attachment chat */
const ALLOWED_MIME_TYPES = [
  // Gambar
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  // Video
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/avi',
  // Audio
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/webm',
  // Dokumen & WPS Office
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/wps-office.xls',
  'application/wps-office.xlsx',
  'application/wps-office.doc',
  'application/wps-office.docx',
  'application/wps-office.ppt',
  'application/wps-office.pptx',
  'application/wps-office.wps',
  'application/wps-office.et',
  'application/wps-office.dps',
  'application/wps-office.pdf',
  'text/plain',
  'application/zip',
  'application/x-rar-compressed',
];

/**
 * Fungsi pemilihan ekstensi file yang aman.
 * Prioritas: ekstensi dari originalname, fallback dari MIME type.
 */
const safeExtension = (file: MulterFile): string => {
  const ext = extname(file.originalname).toLowerCase();
  const mimeExtMap: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'audio/mpeg': '.mp3',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'application/pdf': '.pdf',
    'application/wps-office.xls': '.xls',
    'application/wps-office.xlsx': '.xlsx',
    'application/wps-office.doc': '.doc',
    'application/wps-office.docx': '.docx',
    'application/wps-office.ppt': '.ppt',
    'application/wps-office.pptx': '.pptx',
    'text/plain': '.txt',
    'application/zip': '.zip',
  };

  if (ext && ext.length > 1 && ext.length <= 6) return ext;
  return mimeExtMap[file.mimetype] ?? '.bin';
};

@ApiTags('Chat - Upload')
@Controller('chat')
export class ChatUploadController {
  constructor(private readonly tenantContext: TenantContextService) {}

  /**
   * Upload satu file attachment untuk pesan chat (gambar, video, dokumen, audio).
   *
   * Mengikuti konsep multi-tenant UploadStorageHelper sama seperti Galeri:
   * 1. File sementara disimpan di storage/uploads/chat/.tmp/
   * 2. Dipindahkan ke storage/uploads/{tenantSlug}/chat/{tahun}/{bulan}/{uuid}{ext}
   * 3. Menghasilkan URL publik: /chat/media/{tenantSlug}/chat/{tahun}/{bulan}/{uuid}{ext}
   */
  @Post('upload')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Upload attachment untuk pesan chat (gambar, video, dokumen, audio)',
    description:
      'Upload satu file attachment dengan konsep multi-tenant storage yang sama seperti Galeri. ' +
      'Response berisi URL publik yang kemudian dikirim bersama pesan chat.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File yang akan diunggah (maks 50 MB)',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File berhasil diunggah',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', example: '/chat/media/default/chat/2026/09/uuid.jpg' },
        fullUrl: { type: 'string', example: 'http://localhost:4000/chat/media/default/chat/2026/09/uuid.jpg' },
        fileName: { type: 'string', example: 'default/chat/2026/09/uuid.jpg' },
        originalName: { type: 'string', example: 'foto-rapat.jpg' },
        mimeType: { type: 'string', example: 'image/jpeg' },
        size: { type: 'number', example: 204800 },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const tempPath = path.join(process.cwd(), 'storage', 'uploads', 'chat', '.tmp');
          if (!fs.existsSync(tempPath)) {
            fs.mkdirSync(tempPath, { recursive: true });
          }
          cb(null, tempPath);
        },
        filename: (req, file, cb) => {
          const ext = safeExtension(file);
          const fileName = `${Date.now()}-${randomUUID()}${ext}`;
          cb(null, fileName);
        },
      }),
      limits: {
        fileSize: MAX_FILE_SIZE,
        files: 1,
      },
      fileFilter: (req, file, cb) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              `Format file tidak didukung: ${file.mimetype}. ` +
                'Hanya gambar, video, audio, PDF, dan dokumen Office yang diizinkan.',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  uploadAttachment(@UploadedFile() file: MulterFile, @Req() req: any) {
    if (!file) {
      throw new BadRequestException('File tidak boleh kosong');
    }

    // 1. Ambil slug dari TenantContext terpusat
    const slug = this.tenantContext.getSlug() || 'default';
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, '0');

    // 2. Dapatkan path penyimpanan terpusat (konsep Galeri: /storage/uploads/{slug}/chat/{year}/{month})
    const { relativeFolder, absoluteFolder } = UploadStorageHelper.getUploadPath(
      slug,
      'chat',
      year,
      month,
    );
    UploadStorageHelper.ensureDirectoryExists(absoluteFolder);

    const targetFilePath = path.join(absoluteFolder, file.filename);

    // 3. Resolusi path sumber (temp file)
    const sourcePath = file.path
      ? (path.isAbsolute(file.path) ? file.path : path.resolve(process.cwd(), file.path))
      : path.join(process.cwd(), 'storage/uploads/chat/.tmp', file.filename);

    if (!fs.existsSync(sourcePath)) {
      throw new BadRequestException(`File upload sementara tidak ditemukan`);
    }

    // 4. Pindahkan file dari temp storage ke folder tujuan final via UploadStorageHelper
    UploadStorageHelper.moveFile(sourcePath, targetFilePath);

    const storedFileName = path.join(relativeFolder, file.filename).replace(/\\/g, '/');

    const host = req.get('host') || req.hostname;
    const protocol = req.protocol || 'http';
    const relativeUrl = `/chat/media/${storedFileName}`;
    const fullUrl = process.env.APP_URL
      ? `${process.env.APP_URL}/chat/media/${storedFileName}`
      : `${protocol}://${host}${relativeUrl}`;

    return {
      url: relativeUrl,
      fullUrl,
      fileName: storedFileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    };
  }

  /**
   * Stream atau serve file media chat berdasarkan relative path.
   * Menggunakan UploadStorageHelper.resolveFileForStreaming persis seperti Galeri.
   * Mendukung video range streaming (Partial Content 206).
   */
  @Get('media/*path')
  @Public()
  @ApiOperation({ summary: 'Stream / ambil file attachment chat berdasarkan relative path' })
  @ApiHeader({
    name: 'range',
    required: false,
    description: 'Header Byte Range untuk streaming media (cth: bytes=0-1048575)',
  })
  async getMedia(@Req() req: Request, @Res() res: Response) {
    const rawPath = (req.params as any).path || (req.params as any)[0] || (req.params as any)['0'] || '';
    const filePath = UploadStorageHelper.resolveFileForStreaming(rawPath, 'chat');

    if (!filePath || !fs.existsSync(filePath)) {
      throw new NotFoundException('File attachment tidak ditemukan');
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
    else if (ext === '.mp4') contentType = 'video/mp4';
    else if (ext === '.webm') contentType = 'video/webm';
    else if (ext === '.mov') contentType = 'video/quicktime';
    else if (ext === '.mp3') contentType = 'audio/mpeg';
    else if (ext === '.ogg') contentType = 'audio/ogg';
    else if (ext === '.wav') contentType = 'audio/wav';
    else if (ext === '.pdf') contentType = 'application/pdf';

    const MAX_CHUNK_SIZE = 8 * 1024 * 1024; // 8MB chunk

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
      });

      return stream.pipe(res);
    }

    res.setHeader('Content-Length', fileSize);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    return fs.createReadStream(filePath).pipe(res);
  }
}
