import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsIn, IsOptional } from 'class-validator';

export class CreatePendidikanDto {
  @ApiProperty({ example: 'Strata 1 (S1)' })
  @IsString()
  @IsNotEmpty()
  nama: string;

  @ApiProperty({ example: 'Y' })
  @IsString()
  @IsOptional()
  @IsIn(['Y', 'N'], { message: 'Status hanya boleh Y atau N' })
  status?: string;
}

