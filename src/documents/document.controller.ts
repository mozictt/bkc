import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  UseInterceptors,
  UploadedFile,
  Req,
  Res,
  UseGuards,
  UnprocessableEntityException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import type { Request, Response } from 'express';
import { DocumentService } from './document.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { QueryDocumentDto } from './dto/query-document.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';
import { MulterFile } from '@common/types/multer-file.type';
import { ApiBearerAuth, ApiTags, ApiConsumes, ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';

const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.tar', '.tgz', '.gz', '.txt', '.csv'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
  'application/x-tar',
  'application/x-gtar',
  'application/x-gzip',
  'application/gzip',
  'text/plain',
  'text/csv',
  'application/wps-office.xlsx',
  'application/wps-office.docx',
  'application/wps-office.pptx',
  'application/wps-office.xls',
  'application/wps-office.doc',
  'application/wps-office.ppt',
  'application/octet-stream',
];

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller('documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('upload')
  @RequirePermission('Document', 'create')
  @ApiOperation({ summary: 'Unggah berkas dokumen baru (PDF, Word, Excel, ZIP, TAR, dll)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: CreateDocumentDto })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const tempPath = path.join(process.cwd(), 'storage/uploads/documents/.tmp');
          if (!fs.existsSync(tempPath)) {
            fs.mkdirSync(tempPath, { recursive: true });
          }
          cb(null, tempPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${randomUUID()}`;
          const ext = path.extname(file.originalname).toLowerCase();
          cb(null, `${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 50 * 1024 * 1024, // Batasi berkas maksimal 50MB
      },
      fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const isValidExt = ALLOWED_EXTENSIONS.includes(ext);
        const isValidMime = ALLOWED_MIME_TYPES.includes(file.mimetype);

        if (!isValidExt || !isValidMime) {
          return cb(
            new UnprocessableEntityException('Format file atau MIME type tidak diizinkan!'),
            false
          );
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: MulterFile,
    @Body() createDocumentDto: CreateDocumentDto,
    @Req() req: any,
  ) {
    const userId = req.user?.userId;
    return this.documentService.saveFile(file, createDocumentDto, userId);
  }

  @Get()
  @RequirePermission('Document', 'view')
  @ApiOperation({ summary: 'Mendapatkan daftar dokumen terpaginasi (Bebas N+1 Query)' })
  async findAll(@Query() queryDto: QueryDocumentDto) {
    return this.documentService.findAll(queryDto);
  }

  @Get('download/*path')
  @RequirePermission('Document', 'view')
  @ApiOperation({ summary: 'Mengunduh file dokumen terproteksi path traversal' })
  async download(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const rawPath = (req.params as any).path || req.params[0] || req.params['0'] || '';
    return this.documentService.downloadFile(rawPath, res);
  }

  @Delete(':id')
  @RequirePermission('Document', 'delete')
  @ApiOperation({ summary: 'Menghapus dokumen dari sistem' })
  async remove(@Param('id') id: string) {
    return this.documentService.remove(id);
  }
}
