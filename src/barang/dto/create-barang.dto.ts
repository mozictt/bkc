import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateBarangDto {
  @ApiProperty({ example: 'example_value' })
  @IsNotEmpty()
  @IsString()
  nama: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0)
  harga: number;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0)
  stok: number;

  @ApiProperty({ example: 'example_value' })
  @IsOptional()
  @IsString()
  deskripsi?: string;
}
