import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Req,
  Res,
  UnprocessableEntityException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '@auth/jwt-auth.guard';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { RequirePermission } from '../../permissions/decorators/require-permission.decorator';
import { Public } from '@auth/public.decorator';
import { TransactionService } from '../services/transaction.service';
import { CreateTransactionDto } from '../dto/create-transaction.dto';
import { UpdateTransactionDto } from '../dto/update-transaction.dto';
import { TransactionFilterDto } from '../dto/transaction-filter.dto';
import { TransactionSuggestionQueryDto } from '../dto/transaction-suggestion-query.dto';
import { GenerateIncomeDto } from '../dto/generate-income.dto';
import { diskStorage } from 'multer';
import { extname, join, isAbsolute, resolve } from 'path';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { UploadStorageHelper } from '../../common/utils/upload-storage.util';
import { Response } from 'express';

// ---------------------------------------------------------------------------
// Konfigurasi upload temporary foto bukti transaksi
// ---------------------------------------------------------------------------

const tempReceiptStorage = diskStorage({
  destination: (_req, _file, cb) => {
    const tempDir = join(process.cwd(), 'public', 'uploads', 'receipts', '.tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${randomUUID()}`;
    const ext = extname(file.originalname).toLowerCase();
    cb(null, `receipt-${uniqueSuffix}${ext}`);
  },
});

/** Tipe MIME dan ekstensi yang diizinkan untuk foto bukti transaksi */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// ---------------------------------------------------------------------------
// Content-Type map berdasarkan ekstensi file gambar
// ---------------------------------------------------------------------------

const RECEIPT_CONTENT_TYPE_MAP: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

// ---------------------------------------------------------------------------
// Controller: Transaksi Keuangan Rumah Tangga
//
// Note arsitektur:
// Controller ini menangani dua resource:
//   1. CRUD transaksi → prefix `rumah-tangga/transactions`
//   2. Stream foto bukti (struk) → prefix `rt-files`
//
// Dua prefix digunakan karena wildcard route `rt-files/receipt-photo/*`
// berkonflik dengan route dinamis `/:id` apabila berada di prefix yang sama.
// Dengan prefix `rt-files` yang berbeda, tidak ada tumpang-tindih pada
// Express router layer.
// ---------------------------------------------------------------------------

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionGuard)
@Controller()
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  // -------------------------------------------------------------------------
  // CRUD Transaksi
  // -------------------------------------------------------------------------

  @Get('rumah-tangga/transactions')
  @RequirePermission('rumah-tangga.transaksi', 'view')
  @ApiTags('Rumah Tangga - Transaksi')
  @ApiOperation({ summary: 'List transaksi dengan filter dan pagination' })
  async findAll(@Query() filter: TransactionFilterDto) {
    return this.transactionService.findAll(filter);
  }

  @Get('rumah-tangga/transactions/suggestions')
  @RequirePermission('rumah-tangga.transaksi', 'view')
  @ApiTags('Rumah Tangga - Transaksi')
  @ApiOperation({
    summary: 'Daftar saran/autocomplete judul deskripsi transaksi dari riwayat transaksi',
    description:
      'Mengambil daftar deskripsi unik dari riwayat transaksi untuk autocomplete pada form. ' +
      'Mendukung pencarian kata kunci, filter tipe transaksi, dan mengembalikan kategori yang paling sering digunakan.',
  })
  async getSuggestions(@Query() query: TransactionSuggestionQueryDto) {
    return this.transactionService.getSuggestions(query);
  }

  @Get('rumah-tangga/transactions/:id')
  @RequirePermission('rumah-tangga.transaksi', 'view')
  @ApiTags('Rumah Tangga - Transaksi')
  @ApiOperation({ summary: 'Detail transaksi berdasarkan ID' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.transactionService.findOne(id);
  }

  @Post('rumah-tangga/transactions')
  @RequirePermission('rumah-tangga.transaksi', 'create')
  @ApiTags('Rumah Tangga - Transaksi')
  @ApiOperation({ summary: 'Tambah transaksi baru' })
  async create(@Body() dto: CreateTransactionDto) {
    return this.transactionService.create(dto);
  }

  @Patch('rumah-tangga/transactions/:id')
  @RequirePermission('rumah-tangga.transaksi', 'update')
  @ApiTags('Rumah Tangga - Transaksi')
  @ApiOperation({ summary: 'Update transaksi' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionDto,
  ) {
    return this.transactionService.update(id, dto);
  }

  @Delete('rumah-tangga/transactions/:id')
  @RequirePermission('rumah-tangga.transaksi', 'delete')
  @ApiTags('Rumah Tangga - Transaksi')
  @ApiOperation({ summary: 'Soft delete transaksi' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.transactionService.remove(id);
    return { message: 'Transaksi berhasil dihapus' };
  }

  // -------------------------------------------------------------------------
  // Generate Pemasukan Rutin dari Bulan Sebelumnya
  // -------------------------------------------------------------------------

  @Post('rumah-tangga/transactions/generate-income')
  @RequirePermission('rumah-tangga.transaksi', 'create')
  @ApiTags('Rumah Tangga - Transaksi')
  @ApiOperation({
    summary: 'Generate pemasukan rutin dari bulan sebelumnya',
    description:
      'Menyalin semua transaksi PEMASUKAN yang ditandai Rutin (isRecurring=true) ' +
      'dari bulan sebelumnya ke periode target. Tanggal disesuaikan ke bulan target.',
  })
  @ApiBody({ type: GenerateIncomeDto })
  async generateIncomeFromPrevious(@Body() dto: GenerateIncomeDto) {
    const result = await this.transactionService.generateIncomeFromPrevious(
      dto.targetYear,
      dto.targetMonth,
    );

    if (result.generated === 0 && result.skipped === 0) {
      return {
        message: `Tidak ada pemasukan rutin di bulan ${result.sourceMonth}/${result.sourceYear} untuk dijadikan referensi.`,
        generated: 0,
        skipped: 0,
        sourceMonth: result.sourceMonth,
        sourceYear: result.sourceYear,
      };
    }

    return {
      message: `Berhasil generate ${result.generated} pemasukan rutin dari ${result.sourceMonth}/${result.sourceYear}. Dilewati: ${result.skipped}.`,
      generated: result.generated,
      skipped: result.skipped,
      sourceMonth: result.sourceMonth,
      sourceYear: result.sourceYear,
    };
  }

  // -------------------------------------------------------------------------
  // Upload Foto Bukti Transaksi
  // -------------------------------------------------------------------------

  @Post('rumah-tangga/transactions/:id/receipt')
  @RequirePermission('rumah-tangga.transaksi', 'update')
  @ApiTags('Rumah Tangga - Transaksi')
  @ApiOperation({ summary: 'Upload foto bukti transaksi (struk/nota) berbasis tenant slug' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: tempReceiptStorage,
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: (_req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
          return cb(
            new UnprocessableEntityException('Hanya berkas gambar (JPG, PNG, WEBP) yang diizinkan!'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadReceipt(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Berkas foto tidak ditemukan');
    }

    // 1. Ambil & sanitasi slug tenant dari context request untuk proteksi Path Traversal
    const rawSlug = req?.user?.slug || req?.tenant?.slug || 'default';
    const slug = UploadStorageHelper.sanitizePathSegment(rawSlug);

    // 2. Folder target fisik: public/uploads/{slug}/receipts/
    const targetDir = join(process.cwd(), 'public', 'uploads', slug, 'receipts');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const targetFilePath = join(targetDir, file.filename);
    const sourcePath = file.path
      ? (isAbsolute(file.path) ? file.path : resolve(process.cwd(), file.path))
      : join(process.cwd(), 'public', 'uploads', 'receipts', '.tmp', file.filename);

    if (!fs.existsSync(sourcePath)) {
      throw new UnprocessableEntityException('Berkas sementara tidak ditemukan.');
    }

    // 3. Pindahkan berkas fisik ke folder target slug
    try {
      fs.renameSync(sourcePath, targetFilePath);
    } catch {
      fs.copyFileSync(sourcePath, targetFilePath);
      fs.unlinkSync(sourcePath);
    }

    // 4. Path relatif yang disimpan di DB: uploads/{slug}/receipts/{filename}
    const relativeDbPath = `uploads/${slug}/receipts/${file.filename}`;
    return this.transactionService.updateReceipt(id, relativeDbPath);
  }

  // -------------------------------------------------------------------------
  // Stream / View Foto Bukti Transaksi (Public, tanpa auth)
  //
  // Prefix `rt-files` digunakan untuk menghindari konflik routing antara
  // wildcard `receipt-photo/*` dan route dinamis `/:id` pada Express router.
  // URL akses: GET /rt-files/receipt-photo/uploads/{slug}/receipts/{filename}
  // -------------------------------------------------------------------------

  @Get('rt-files/receipt-photo/*')
  @Public()
  @ApiTags('Rumah Tangga - Files')
  @ApiOperation({ summary: 'Stream foto bukti transaksi (struk/nota)' })
  async streamReceiptPhoto(@Req() req: any, @Res() res: Response) {
    // Ekstraksi path berkas dari URL secara fleksibel
    let rawPath = req.params?.[0] || req.params?.['0'] || '';

    if (!rawPath) {
      // Fallback: parsing manual dari URL jika params tidak terpopulasi
      const urlsToCheck = [req.originalUrl, req.url, req.path].filter(Boolean);
      for (const u of urlsToCheck) {
        const cleanUrl = (u as string).split('?')[0];
        const markerIdx = cleanUrl.indexOf('receipt-photo/');
        if (markerIdx !== -1) {
          rawPath = decodeURIComponent(cleanUrl.substring(markerIdx + 'receipt-photo/'.length));
          if (rawPath) break;
        }
      }
    }

    if (!rawPath) {
      throw new NotFoundException('Path berkas tidak valid');
    }

    // Sanitasi path traversal: hapus segmen `../` atau `..\`
    const safePath = rawPath
      .replace(/\\/g, '/')
      .split('/')
      .filter((seg) => seg !== '..' && seg !== '.')
      .join('/');

    if (!safePath) {
      throw new NotFoundException('Path berkas tidak valid');
    }

    // Resolusi jalur fisik berkas
    const absolutePath = join(process.cwd(), 'public', safePath);

    // Pastikan path akhir masih berada di dalam direktori `public/` (path traversal guard)
    const publicRoot = join(process.cwd(), 'public');
    if (!absolutePath.startsWith(publicRoot)) {
      throw new NotFoundException('Akses ditolak: path berkas di luar direktori yang diizinkan');
    }

    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
      throw new NotFoundException('Foto bukti transaksi tidak ditemukan');
    }

    // Tentukan Content-Type berdasarkan ekstensi file
    const ext = extname(absolutePath).toLowerCase();
    const contentType = RECEIPT_CONTENT_TYPE_MAP[ext] ?? 'application/octet-stream';

    const stat = fs.statSync(absolutePath);
    res.writeHead(200, {
      'Content-Length': stat.size,
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    });

    fs.createReadStream(absolutePath).pipe(res);
  }
}
