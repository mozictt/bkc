import { IsNotEmpty, IsString, IsEmail, IsOptional, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePegawaiDto {
  @ApiProperty({ example: 'PEG-001', description: 'Nomor Induk Pegawai (NIP)' })
  @IsNotEmpty({ message: 'NIP wajib diisi' })
  @IsString({ message: 'NIP harus berupa text' })
  @MaxLength(50, { message: 'NIP maksimal 50 karakter' })
  nip: string;

  @ApiProperty({ example: 'Budi Santoso', description: 'Nama Lengkap Pegawai' })
  @IsNotEmpty({ message: 'Nama lengkap wajib diisi' })
  @IsString({ message: 'Nama lengkap harus berupa text' })
  @MaxLength(150, { message: 'Nama lengkap maksimal 150 karakter' })
  name: string;

  @ApiPropertyOptional({ example: 'budi@example.com', description: 'Alamat Email Pegawai' })
  @IsOptional()
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(150, { message: 'Email maksimal 150 karakter' })
  email?: string;

  @ApiPropertyOptional({ example: '081234567890', description: 'Nomor Handphone Pegawai' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s]+$/, { message: 'Nomor telepon hanya boleh berisi angka, spasi, tanda + atau -' })
  @MaxLength(20, { message: 'Nomor telepon maksimal 20 karakter' })
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'Staff IT', description: 'Jabatan Pegawai' })
  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Jabatan maksimal 100 karakter' })
  position?: string;

  @ApiPropertyOptional({ example: 'Saya adalah staff IT', description: 'Bio singkat pegawai' })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Bio maksimal 500 karakter' })
  bio?: string;

  @ApiPropertyOptional({ example: 'Jl. Merdeka No. 45, Jakarta Pusat', description: 'Alamat tinggal pegawai' })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Alamat maksimal 500 karakter' })
  address?: string;

  @ApiPropertyOptional({ example: '31.71.01.1001', description: 'ID Kelurahan tempat tinggal pegawai (BPS/Kemendagri)' })
  @IsOptional()
  @IsString()
  @MaxLength(13, { message: 'ID Kelurahan maksimal 13 karakter' })
  idKelurahan?: string;
}

