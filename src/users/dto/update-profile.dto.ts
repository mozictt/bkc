import { IsString, IsEmail, IsOptional, MaxLength, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Budi Santoso', description: 'Nama Lengkap Pegawai' })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ example: 'budi@example.com', description: 'Alamat Email Pegawai' })
  @IsOptional()
  @IsEmail({}, { message: 'Format email tidak valid' })
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ example: '081234567890', description: 'Nomor Handphone Pegawai' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9+\-\s]+$/, { message: 'Nomor telepon hanya boleh berisi angka, spasi, tanda + atau -' })
  @MaxLength(20)
  phoneNumber?: string;

  @ApiPropertyOptional({ example: 'Saya adalah seorang staff IT senior', description: 'Bio/Deskripsi singkat' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ example: 'Jl. Merdeka No. 45, Jakarta Pusat', description: 'Alamat tempat tinggal' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;
}
