import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsIn, IsOptional } from 'class-validator';

export class CreateKategoriDto {
  @ApiProperty({ example: 'example_value' })
  @IsString()
  @IsNotEmpty()
  nama: string;

  @ApiProperty({ example: 'example_value' })
  @IsString()
  @IsOptional()
  @IsIn(['Y', 'N'], { message: 'Status hanya boleh Y atau N' })
  status?: string;
}