import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CreateBarangDto } from './create-barang.dto';

export class CreateBulkBarangDto {
  @ApiProperty({ example: 'example_value' })
  @IsString()
  @IsNotEmpty()
  kategori: string;

  @ApiProperty({ example: [] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBarangDto)
  data: CreateBarangDto[];
}
