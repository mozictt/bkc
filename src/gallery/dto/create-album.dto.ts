import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString } from 'class-validator';

export class CreateAlbumDto {
  @ApiProperty({ example: 'Sample Name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Sample Description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'example_value' })
  @IsOptional()
  @IsDateString()
  date?: string;
}
