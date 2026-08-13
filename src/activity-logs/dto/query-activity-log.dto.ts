import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsInt, IsDateString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryActivityLogDto {
  @ApiPropertyOptional({ example: '2026-08-01', description: 'Tanggal mulai pencarian (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-08-13', description: 'Tanggal akhir pencarian (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 1, description: 'Filter berdasarkan ID User' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  userId?: number;

  @ApiPropertyOptional({ example: 'BARANG', description: 'Filter berdasarkan Modul (misal: AUTH, USERS, BARANG, GALLERY)' })
  @IsOptional()
  @IsString()
  module?: string;

  @ApiPropertyOptional({ example: 'CREATE', description: 'Filter berdasarkan Aksi (misal: CREATE, UPDATE, DELETE, LOGIN, LOGOUT)' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ example: 'admin', description: 'Pencarian teks bebas pada username, deskripsi, atau path' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 1, default: 1, description: 'Nomor halaman pagination' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10, description: 'Jumlah baris data per halaman' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
