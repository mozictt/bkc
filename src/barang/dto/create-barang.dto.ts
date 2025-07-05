import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  Min,
} from 'class-validator';

export class CreateBarangDto {
  @IsNotEmpty()
  @IsString()
  nama: string;

  @IsNumber()
  @Min(0)
  harga: number;

  @IsNumber()
  @Min(0)
  stok: number;

  @IsOptional()
  @IsString()
  deskripsi?: string;
}
