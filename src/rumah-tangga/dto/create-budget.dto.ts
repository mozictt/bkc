import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class CreateBudgetDto {
  @ApiProperty({ example: 1, description: 'ID kategori pengeluaran' })
  @IsNotEmpty()
  @IsNumber()
  categoryId: number;

  @ApiProperty({ example: 2026, description: 'Tahun periode anggaran' })
  @IsNotEmpty()
  @IsNumber()
  @Min(2020)
  @Max(2100)
  periodYear: number;

  @ApiProperty({ example: 10, description: 'Bulan periode anggaran (1-12)' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(12)
  periodMonth: number;

  @ApiProperty({ example: 3000000, description: 'Nominal anggaran dalam Rupiah' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  budgetAmount: number;

  @ApiPropertyOptional({ example: 'Anggaran belanja dapur bulan Oktober', description: 'Catatan' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
