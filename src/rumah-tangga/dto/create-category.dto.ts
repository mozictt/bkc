import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsNumber,
  MaxLength,
  Min,
} from 'class-validator';
import { CategoryType } from '../constants/category-type.enum';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Belanja Dapur', description: 'Nama kategori' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'mdi-cart', description: 'Nama icon (Material Design Icons)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiProperty({
    example: CategoryType.PENGELUARAN,
    enum: CategoryType,
    description: 'Tipe kategori: PENGELUARAN atau PEMASUKAN',
  })
  @IsNotEmpty()
  @IsEnum(CategoryType)
  type: CategoryType;

  @ApiPropertyOptional({ example: '#FF6384', description: 'Warna HEX untuk chart' })
  @IsOptional()
  @IsString()
  @MaxLength(7)
  color?: string;

  @ApiPropertyOptional({ example: 1, description: 'Urutan tampilan' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  orderNo?: number;
}
