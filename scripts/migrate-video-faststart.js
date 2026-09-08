const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

function getFfmpegPath() {
  try {
    const staticPath = require('ffmpeg-static');
    if (staticPath) return staticPath;
  } catch (e) {}
  return 'ffmpeg';
}

function findMp4Files(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findMp4Files(filePath, fileList);
    } else if (file.toLowerCase().endsWith('.mp4') && !file.includes('.faststart.')) {
      fileList.push(filePath);
    }
  }

  return fileList;
}

async function runMigration() {
  const ffmpegExec = getFfmpegPath();
  const galleryStorageDir = path.join(process.cwd(), 'storage/uploads/gallery');

  console.log(`🔍 Mengumpulkan seluruh file video MP4 lama dari: ${galleryStorageDir}...`);
  const mp4Files = findMp4Files(galleryStorageDir);

  if (mp4Files.length === 0) {
    console.log('✅ Tidak ada file video lama yang perlu diproses.');
    return;
  }

  console.log(`📦 Ditemukan ${mp4Files.length} file video MP4. Memulai migrasi FastStart (-movflags +faststart)...\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < mp4Files.length; i++) {
    const videoPath = mp4Files[i];
    const tempPath = `${videoPath}.faststart.mp4`;

    process.stdout.write(`[${i + 1}/${mp4Files.length}] Memproses ${path.basename(videoPath)}... `);

    try {
      await execFileAsync(ffmpegExec, [
        '-i', videoPath,
        '-c', 'copy',
        '-movflags', '+faststart',
        '-y',
        tempPath,
      ]);

      if (fs.existsSync(tempPath)) {
        fs.renameSync(tempPath, videoPath);
        console.log('✅ BERHASIL');
        successCount++;
      } else {
        console.log('⚠️ GAGAL');
        failCount++;
      }
    } catch (err) {
      console.log(`❌ ERROR: ${err.message}`);
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      failCount++;
    }
  }

  console.log(`\n🎉 Migrasi selesai! Sukses: ${successCount}, Gagal: ${failCount}`);
}

runMigration();
