import * as fs from 'fs';
import * as path from 'path';
const sharp = require('sharp');

const UPLOADS_ROOT = path.join(process.cwd(), 'storage/uploads');
const THUMBNAILS_ROOT = path.join(UPLOADS_ROOT, '.thumbnails');

async function processDirectory(dirPath: string): Promise<{ success: number; skipped: number; failed: number }> {
  let success = 0;
  let skipped = 0;
  let failed = 0;

  if (!fs.existsSync(dirPath)) {
    console.log(`[Thumbnail Migration] Path ${dirPath} tidak ditemukan.`);
    return { success, skipped, failed };
  }

  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === '.thumbnails' || entry.name === '.tmp') {
        continue;
      }
      const subResult = await processDirectory(fullPath);
      success += subResult.success;
      skipped += subResult.skipped;
      failed += subResult.failed;
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const validImageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.jfif', '.heic', '.heif', '.avif'];
      const validVideoExts = ['.mp4', '.webm', '.mov', '.mkv', '.avi'];

      const isPhoto = validImageExts.includes(ext);
      const isVideo = validVideoExts.includes(ext);

      if (!isPhoto && !isVideo) {
        continue;
      }

      const relPath = path.relative(UPLOADS_ROOT, fullPath);
      const parsed = path.parse(relPath);
      const thumbRelPath = path.join(parsed.dir, `${parsed.name}.webp`);
      const thumbPath = path.join(THUMBNAILS_ROOT, thumbRelPath);
      const thumbDir = path.dirname(thumbPath);

      if (fs.existsSync(thumbPath)) {
        skipped++;
        continue;
      }

      try {
        if (!fs.existsSync(thumbDir)) {
          fs.mkdirSync(thumbDir, { recursive: true });
        }

        if (isPhoto) {
          await sharp(fullPath)
            .resize({ width: 400, height: 400, fit: 'cover', withoutEnlargement: true })
            .webp({ quality: 75 })
            .toFile(thumbPath);
        } else if (isVideo) {
          const { execFile } = require('child_process');
          const { promisify } = require('util');
          const execFileAsync = promisify(execFile);
          let ffmpegExec = 'ffmpeg';
          try {
            const staticPath = require('ffmpeg-static');
            if (staticPath) ffmpegExec = staticPath;
          } catch (e) {}

          await execFileAsync(ffmpegExec, [
            '-ss', '00:00:01',
            '-i', fullPath,
            '-vframes', '1',
            '-vf', 'scale=400:-1',
            '-y',
            thumbPath,
          ], { timeout: 15000 });
        }

        if (fs.existsSync(thumbPath)) {
          success++;
          console.log(`[OK] Thumbnail dibuat: ${relPath} -> .thumbnails/${thumbRelPath}`);
        } else {
          failed++;
          console.warn(`[WARN] File thumbnail tidak terbentuk untuk ${entry.name}`);
        }
      } catch (err: any) {
        failed++;
        console.error(`[ERROR] Gagal membuat thumbnail untuk ${entry.name}:`, err.message);
      }
    }
  }

  return { success, skipped, failed };
}

async function main() {
  console.log('===================================================');
  console.log('🚀 MEMULAI GENERASI THUMBNAIL MASSAL DATA GALERI');
  console.log('===================================================');
  console.log(`Penyimpanan root   : ${UPLOADS_ROOT}`);
  console.log(`Penyimpanan thumb  : ${THUMBNAILS_ROOT}\n`);

  const result = await processDirectory(UPLOADS_ROOT);

  console.log('\n===================================================');
  console.log('✅ PROSES GENERASI THUMBNAIL SELESAI');
  console.log(`- Berhasil dibuat : ${result.success} file`);
  console.log(`- Dilewati (ada) : ${result.skipped} file`);
  console.log(`- Gagal          : ${result.failed} file`);
  console.log('===================================================');
}

main().catch(console.error);
