import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsBoolean, IsDateString, IsObject } from 'class-validator';

export class UpdateTenantDto {
  @ApiPropertyOptional({ example: 'Klinik Sehat Utama', description: 'Nama Tenant/Klinik' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'admin@kliniksehat.com', description: 'Email Kontak Tenant' })
  @IsOptional()
  @IsEmail({}, { message: 'Format email tidak valid' })
  email?: string;

  @ApiPropertyOptional({ example: '2026-12-31T23:59:59.000Z', description: 'Tanggal Kadaluarsa Berlangganan (ISO Date)' })
  @IsOptional()
  @IsDateString({}, { message: 'Format tanggal expiredAt tidak valid' })
  expiredAt?: string;

  @ApiPropertyOptional({ example: true, description: 'Status Aktif Tenant' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: { theme: 'dark' }, description: 'Pengaturan Kustom Tenant (JSON)' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;
}
