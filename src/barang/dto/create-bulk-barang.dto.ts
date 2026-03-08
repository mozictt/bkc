import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBarangDto } from './create-barang.dto';

export class CreateBulkBarangDto {
  @IsString()
  @IsNotEmpty()
  kategori: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBarangDto)
  data: CreateBarangDto[];
}
