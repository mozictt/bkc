import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsNumber,
  IsDateString,
  IsBoolean,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '../constants/transaction-type.enum';

/**
 * DTO untuk filter & pagination transaksi.
 * Mendukung filter berdasarkan tipe, kategori, anggota keluarga, rentang tanggal, dan pencarian.
 */
export class TransactionFilterDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({ enum: TransactionType, description: 'Filter berdasarkan tipe' })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({ example: 1, description: 'Filter berdasarkan ID kategori' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  categoryId?: number;

  @ApiPropertyOptional({ example: 1, description: 'Filter berdasarkan ID anggota keluarga' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  familyMemberId?: number;

  @ApiPropertyOptional({ example: '2026-10-01', description: 'Tanggal mulai (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-10-31', description: 'Tanggal akhir (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ example: 10, description: 'Bulan (1-12)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  month?: number;

  @ApiPropertyOptional({ example: 2026, description: 'Tahun (YYYY)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  year?: number;

  @ApiPropertyOptional({ example: true, description: 'Filter hanya pengeluaran rutin' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isRecurring?: boolean;

  @ApiPropertyOptional({ example: 'indomaret', description: 'Cari berdasarkan deskripsi' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'transaction_date', description: 'Sort berdasarkan kolom' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ example: 'DESC', description: 'Arah sort: ASC atau DESC' })
  @IsOptional()
  @IsString()
  sortType?: string;
}
