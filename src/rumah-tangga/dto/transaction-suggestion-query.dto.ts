import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { TransactionType } from '../constants/transaction-type.enum';

/**
 * Query DTO untuk mendapatkan daftar saran (autocomplete) judul/deskripsi transaksi
 * dari riwayat tabel rt_transactions.
 */
export class TransactionSuggestionQueryDto {
  @ApiPropertyOptional({
    description: 'Kata kunci pencarian judul/deskripsi transaksi',
    example: 'belanja',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: TransactionType,
    description: 'Filter berdasarkan tipe transaksi (INCOME atau EXPENSE)',
    example: TransactionType.EXPENSE,
  })
  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @ApiPropertyOptional({
    description: 'Batas maksimal saran yang dikembalikan (default: 10, max: 30)',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(30)
  limit?: number;
}
