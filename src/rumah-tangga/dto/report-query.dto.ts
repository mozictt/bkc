import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO untuk query parameter laporan keuangan.
 * Default: bulan dan tahun saat ini.
 */
export class ReportQueryDto {
  @ApiPropertyOptional({ example: 2026, description: 'Tahun laporan' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(2020)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({ example: 10, description: 'Bulan laporan (1-12)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(12)
  month?: number;
}
