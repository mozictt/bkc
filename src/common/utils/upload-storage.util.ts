import * as path from 'path';
import * as fs from 'fs';

export interface StoragePathResult {
  relativeFolder: string;
  absoluteFolder: string;
}

export class UploadStorageHelper {
  private static readonly baseUploadsRoot = path.join(process.cwd(), 'storage/uploads');

  /**
   * Sanitasi segmen path agar aman dari karakter ilegal file system dan path traversal.
   * Contoh: "Foto Liburan 2026!" => "foto-liburan-2026"
   */
  static sanitizePathSegment(segment: string): string {
    if (!segment) return 'default';
    return (
      segment
        .trim()
        .replace(/[^a-zA-Z0-9_\-\s]/g, '') // Hapus karakter khusus berbahaya
        .replace(/\s+/g, '-')              // Ubah spasi menjadi strip (-)
        .toLowerCase() || 'default'
    );
  }

  /**
   * Menghasilkan path folder penyimpanan berbasis tenant slug secara terpusat.
   * Format: /storage/uploads/{slug}/{moduleName}/{...subFolders}
   * 
   * Contoh Penggunaan:
   * - UploadStorageHelper.getUploadPath('mozict', 'gallery', 'liburan-bali')
   *   -> relativeFolder: 'mozict/gallery/liburan-bali'
   *   -> absoluteFolder: '/app/storage/uploads/mozict/gallery/liburan-bali'
   * 
   * - UploadStorageHelper.getUploadPath('mozict', 'company-profile')
   *   -> relativeFolder: 'mozict/company-profile'
   *   -> absoluteFolder: '/app/storage/uploads/mozict/company-profile'
   * 
   * @param slug Slug tenant (misal: 'mozict')
   * @param moduleName Nama modul/fitur (misal: 'gallery', 'company-profile', 'products')
   * @param subFolders Sub-folder tambahan opsional (misal: nama album, kategori, dll)
   */
  static getUploadPath(
    slug?: string,
    moduleName: string = 'general',
    ...subFolders: string[]
  ): StoragePathResult {
    const sanitizedSlug = this.sanitizePathSegment(slug || 'default');
    const sanitizedModule = this.sanitizePathSegment(moduleName);
    const sanitizedSubFolders = subFolders.map((sf) => this.sanitizePathSegment(sf));

    const relativeFolder = path
      .join(sanitizedSlug, sanitizedModule, ...sanitizedSubFolders)
      .replace(/\\/g, '/');

    const absoluteFolder = path.join(this.baseUploadsRoot, relativeFolder);

    return { relativeFolder, absoluteFolder };
  }

  /**
   * Memastikan folder tujuan ada di disk storage. Jika belum ada, buat secara rekursif.
   */
  static ensureDirectoryExists(absoluteFolder: string): void {
    if (!fs.existsSync(absoluteFolder)) {
      fs.mkdirSync(absoluteFolder, { recursive: true });
    }
  }

  /**
   * Pindahkan file dari direktori sementara (temp) ke direktori tujuan akhir.
   */
  static moveFile(sourceTempPath: string, targetFilePath: string): void {
    const targetDir = path.dirname(targetFilePath);
    this.ensureDirectoryExists(targetDir);

    try {
      fs.renameSync(sourceTempPath, targetFilePath);
    } catch {
      fs.copyFileSync(sourceTempPath, targetFilePath);
      fs.unlinkSync(sourceTempPath);
    }
  }

  /**
   * Resolusi path file fisik untuk streaming/download dengan proteksi Path Traversal
   * serta fitur fallback ke struktur folder legacy jika file lama belum dipindah.
   */
  static resolveFileForStreaming(
    rawPath: string | string[],
    ...legacySubfolders: string[]
  ): string | null {
    if (!rawPath) return null;

    // Safely join array if rawPath is passed as an array from NestJS wildcard route
    const pathString = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath);

    // Normalisasi & pencegahan Path Traversal Attack
    const normalized = path.normalize(pathString).replace(/^(\.\.[\/\\])+/, '');
    let filePath = path.join(this.baseUploadsRoot, normalized);

    // 1. Cek di path utama (/storage/uploads/{normalized})
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      if (filePath.startsWith(this.baseUploadsRoot)) {
        return filePath;
      }
    }

    // 2. Cek fallback legacy subfolders jika file lama tersimpan sebelum refactoring
    for (const legacySubfolder of legacySubfolders) {
      const legacyPath = path.join(
        this.baseUploadsRoot,
        legacySubfolder,
        path.basename(normalized),
      );
      if (fs.existsSync(legacyPath) && fs.statSync(legacyPath).isFile()) {
        if (legacyPath.startsWith(this.baseUploadsRoot)) {
          return legacyPath;
        }
      }

      // Cek fallback legacy path persis: /storage/uploads/{legacySubfolder}/{normalized}
      const legacyExactPath = path.join(this.baseUploadsRoot, legacySubfolder, normalized);
      if (fs.existsSync(legacyExactPath) && fs.statSync(legacyExactPath).isFile()) {
        if (legacyExactPath.startsWith(this.baseUploadsRoot)) {
          return legacyExactPath;
        }
      }
    }

    return null;
  }

  /**
   * Hapus file fisik di storage secara aman dengan proteksi Path Traversal & Fallback.
   */
  static removeFile(rawPath: string, ...legacySubfolders: string[]): boolean {
    const filePath = this.resolveFileForStreaming(rawPath, ...legacySubfolders);
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        return true;
      } catch (err) {
        console.error(`[UploadStorageHelper] Gagal menghapus file: ${filePath}`, err);
      }
    }
    return false;
  }
}
