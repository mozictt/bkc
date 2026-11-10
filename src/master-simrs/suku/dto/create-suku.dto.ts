import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsIn, IsOptional } from 'class-validator';

export class CreateSukuDto {
  @ApiProperty({ example: 'Jawa' })
  @IsString()
  @IsNotEmpty()
  nama: string;

  @ApiProperty({ example: 'Y' })
  @IsString()
  @IsOptional()
  @IsIn(['Y', 'N'], { message: 'Status hanya boleh Y atau N' })
  status?: string;
}

