// /home/mozict/project/backend/src/barang/barang-root.module.ts (Contoh Modul Baru)
import { Module } from '@nestjs/common';
import { BarangModule } from './barang.module';
import { KategoriModule } from './kategori.module';

@Module({
  imports: [BarangModule, KategoriModule],
  exports: [BarangModule, KategoriModule],
})
export class BarangRootModule {}
