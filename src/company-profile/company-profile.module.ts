// src/company-profile/company-profile.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';

import { CompanyProfileController } from './company-profile.controller';
import { CompanyProfileService } from './company-profile.service';
import { CompanyProfile } from './entities/company-profile.entity';

@Module({
  imports: [
    // Daftarkan entity ke TypeORM
    TypeOrmModule.forFeature([CompanyProfile]),

    // Konfigurasi multer di level modul (optional, sudah di controller)
    MulterModule.register(),
  ],
  controllers: [CompanyProfileController],
  providers: [CompanyProfileService],
  exports: [CompanyProfileService], // Ekspor jika dipakai modul lain
})
export class CompanyProfileModule {}
