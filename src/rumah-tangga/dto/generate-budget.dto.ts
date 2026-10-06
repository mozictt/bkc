import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsBoolean, Min, Max } from 'class-validator';

export class GenerateBudgetDto {
  @ApiProperty({ example: 2026, description: 'Tahun periode TARGET yang akan di-generate' })
  @IsNotEmpty()
  @IsNumber()
  @Min(2020)
  @Max(2100)
  targetYear: number;

  @ApiProperty({ example: 10, description: 'Bulan periode TARGET (1-12)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(12)
  targetMonth: number;

  @ApiPropertyOptional({
    example: false,
    description:
      'Jika true, anggaran yang sudah ada di periode target akan ditimpa (overwrite). ' +
      'Default: false (lewati item yang sudah ada).',
  })
  @IsOptional()
  @IsBoolean()
  overwrite?: boolean;
}
