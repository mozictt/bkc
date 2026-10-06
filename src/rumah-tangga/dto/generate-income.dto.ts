import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, Min, Max } from 'class-validator';

export class GenerateIncomeDto {
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
}
