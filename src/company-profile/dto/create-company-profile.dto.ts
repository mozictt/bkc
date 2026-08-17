// src/company-profile/dto/create-company-profile.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  IsUrl,
  MaxLength,
  IsDateString,
  Matches,
} from 'class-validator';

export class CreateCompanyProfileDto {
  // ─── Identitas Perusahaan ─────────────────────────────────────────────────

  @ApiProperty({ example: 'PT. Maju Bersama Teknologi', description: 'Nama lengkap perusahaan' })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ example: 'MBT', description: 'Nama singkat atau singkatan perusahaan' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  shortName?: string;

  @ApiPropertyOptional({ example: 'Perusahaan teknologi yang bergerak di bidang...', description: 'Deskripsi singkat perusahaan' })
  @IsOptional()
  @IsString()
  description?: string;

  // ─── Kontak ───────────────────────────────────────────────────────────────

  @ApiProperty({ example: 'info@majubersama.co.id', description: 'Email resmi perusahaan' })
  @IsEmail({}, { message: 'Format email tidak valid' })
  email: string;

  @ApiProperty({ example: '021-12345678', description: 'Nomor telepon perusahaan' })
  @IsString()
  @MaxLength(30)
  phone: string;

  @ApiPropertyOptional({ example: '021-87654321', description: 'Nomor fax perusahaan' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  fax?: string;

  @ApiPropertyOptional({ example: 'https://majubersama.co.id', description: 'Website resmi perusahaan' })
  @IsOptional()
  @IsUrl({}, { message: 'Format URL website tidak valid' })
  @MaxLength(255)
  website?: string;

  // ─── Alamat ───────────────────────────────────────────────────────────────

  @ApiProperty({ example: 'Jl. Sudirman No. 99, Kec. Tanah Abang', description: 'Alamat lengkap perusahaan' })
  @IsString()
  address: string;

  @ApiPropertyOptional({ example: 'Jakarta Pusat', description: 'Kota domisili perusahaan' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'DKI Jakarta', description: 'Provinsi domisili perusahaan' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;

  @ApiPropertyOptional({ example: '10220', description: 'Kode pos perusahaan' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  postalCode?: string;

  @ApiPropertyOptional({ example: 'Indonesia', description: 'Negara domisili perusahaan' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiPropertyOptional({ example: '31.71.01.1001', description: 'ID Kelurahan domisili perusahaan (BPS/Kemendagri)' })
  @IsOptional()
  @IsString()
  @MaxLength(13)
  idKelurahan?: string;

  // ─── Legal & Bisnis ───────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: '01.234.567.8-901.000', description: 'NPWP perusahaan' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  npwp?: string;

  @ApiPropertyOptional({ example: '1234567890123', description: 'Nomor Induk Berusaha (NIB)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  nib?: string;

  @ApiPropertyOptional({ example: '2010-01-15', description: 'Tanggal berdiri perusahaan (format: YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString({}, { message: 'Format tanggal berdiri tidak valid (gunakan YYYY-MM-DD)' })
  foundedAt?: string;

  // ─── Sosial Media ─────────────────────────────────────────────────────────

  @ApiPropertyOptional({ example: 'https://instagram.com/majubersama', description: 'URL Instagram perusahaan' })
  @IsOptional()
  @IsUrl({}, { message: 'Format URL Instagram tidak valid' })
  @MaxLength(255)
  instagram?: string;

  @ApiPropertyOptional({ example: 'https://facebook.com/majubersama', description: 'URL Facebook perusahaan' })
  @IsOptional()
  @IsUrl({}, { message: 'Format URL Facebook tidak valid' })
  @MaxLength(255)
  facebook?: string;

  @ApiPropertyOptional({ example: 'https://twitter.com/majubersama', description: 'URL Twitter/X perusahaan' })
  @IsOptional()
  @IsUrl({}, { message: 'Format URL Twitter tidak valid' })
  @MaxLength(255)
  twitter?: string;

  @ApiPropertyOptional({ example: 'https://linkedin.com/company/majubersama', description: 'URL LinkedIn perusahaan' })
  @IsOptional()
  @IsUrl({}, { message: 'Format URL LinkedIn tidak valid' })
  @MaxLength(255)
  linkedin?: string;
}
